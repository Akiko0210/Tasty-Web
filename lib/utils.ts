import type { Leg, OptionType, Side, OrderPayload } from "./types";

let legCounter = 0;

export function toLegs(
  config: Omit<Leg, "id" | "visible" | "status" | "daysToExpiry">[],
): Leg[] {
  return config.map((l, i) => {
    legCounter++;
    return {
      ...l,
      id: `leg-${legCounter}-${i}`,
      visible: true,
      status: "Working",
      daysToExpiry: 16,
    };
  });
}

// Builds a dxFeed option symbol from a leg. Requires expiration in YYYY-MM-DD format.
// Returns null if the expiration can't be parsed.
// expirationToRoot maps expiration date → actual root symbol (e.g. "SPXW" for weekly SPX options).
export function legToSymbol(
  leg: Leg,
  rootSymbol = "SPX",
  expirationToRoot?: Record<string, string>,
): string | null {
  const match = leg.expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const cp = leg.type === "Call" ? "C" : "P";
  const effectiveRoot = expirationToRoot?.[leg.expiration] ?? rootSymbol;
  return `.${effectiveRoot}${yyyy.slice(2)}${mm}${dd}${cp}${leg.strike}`;
}

// Builds an OCC option symbol for the TastyTrade API.
// Format: ROOT(6 chars) + YYMMDD + C/P + strike×1000 (8 digits, zero-padded)
// Example: SPX 2026-05-15 Call 6700 → "SPX   260515C06700000"
export function legToOccSymbol(
  leg: Leg,
  rootSymbol: string,
  expirationToRoot?: Record<string, string>,
): string {
  const match = leg.expiration.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  const cp = leg.type === "Call" ? "C" : "P";
  const strikeInt = Math.round(leg.strike * 1000);
  const effectiveRoot = expirationToRoot?.[leg.expiration] ?? rootSymbol;
  return `${effectiveRoot.padEnd(6, " ")}${yyyy.slice(2)}${mm}${dd}${cp}${strikeInt.toString().padStart(8, "0")}`;
}

// Builds the TastyTrade API order payload from the current legs.
// totalCost < 0 = net debit; totalCost > 0 = net credit (from calculateTotalCost).
// Throws if any leg has price === 0 (quotes not loaded yet).
export function buildOrderPayload(
  legs: Leg[],
  rootSymbol: string,
  totalCost: number,
  tif: "Day" | "GTC" = "Day",
  expirationToRoot?: Record<string, string>,
): OrderPayload {
  const unpricedCount = legs.filter((l) => l.price === 0).length;
  if (unpricedCount > 0) {
    throw new Error(
      `${unpricedCount} leg${unpricedCount > 1 ? "s have" : " has"} no price yet — wait for quotes to load or enter prices manually.`,
    );
  }

  const netPrice = totalCost / 100; // positive = credit, negative = debit
  const priceEffect: "Credit" | "Debit" = netPrice > 0 ? "Credit" : "Debit";

  return {
    "time-in-force": tif,
    "order-type": "Limit",
    price: Math.abs(netPrice).toFixed(2),
    "price-effect": priceEffect,
    legs: legs.map((leg) => ({
      "instrument-type": "Equity Option",
      symbol: legToOccSymbol(leg, rootSymbol, expirationToRoot),
      quantity: leg.size,
      action: leg.side === "Long" ? "Buy to Open" : "Sell to Open",
    })),
  };
}

export function calculateTotalCost(legs: Leg[]): number {
  return legs.reduce((total, leg) => {
    const cost = leg.price * leg.size * 100;
    return total + (leg.side === "Long" ? -cost : cost);
  }, 0);
}

// Returns the closest available strike for a new expiration.
export function resolveStrikeOnExpChange(
  newExp: string,
  currentStrike: number,
  strikes: number[] | undefined,
  strikesByExpiration: Record<string, number[]> | undefined,
): number {
  const newStrikes = strikesByExpiration?.[newExp] ?? strikes ?? [];
  if (newStrikes.includes(currentStrike)) return currentStrike;
  if (!newStrikes.length) return currentStrike;
  return newStrikes.reduce((best, s) =>
    Math.abs(s - currentStrike) < Math.abs(best - currentStrike) ? s : best,
  );
}

// Returns the index of the strike closest to the given price.
export function findAtmIndex(strikes: number[], price: number): number {
  return strikes.reduce(
    (best, s, i) =>
      Math.abs(s - price) < Math.abs(strikes[best] - price) ? i : best,
    0,
  );
}

// Returns the number of index steps that correspond to roughly a 5-point wide spread,
// based on the actual strike spacing around the ATM index.
function calcWingStep(strikes: number[], atmIdx: number): number {
  if (strikes.length < 2) return 1;
  const idx = Math.max(1, Math.min(strikes.length - 1, atmIdx));
  const spacing = strikes[idx] - strikes[idx - 1];
  if (spacing <= 0) return 1;
  return Math.max(1, Math.round(5 / spacing));
}

type LegTemplate = Omit<Leg, "id" | "visible" | "status" | "daysToExpiry">;

/**
 * Builds the initial leg set for a named strategy using real option chain data.
 *
 * @param strategyName  Must match a name in strategyConfigs.
 * @param strikes       Sorted ascending array of available strikes from the chain.
 * @param expirations   Sorted ascending array of available expirations (nearest first).
 * @param currentPrice  Live SPX mid-price used to locate the ATM strike.
 */
export function buildStrategyLegs(
  strategyName: string,
  strikes: number[],
  expirations: string[],
  currentPrice: number | null,
): LegTemplate[] {
  if (!strikes.length || !expirations.length) return [];

  const price = currentPrice ?? strikes[Math.floor(strikes.length / 2)];
  const atmIdx = findAtmIndex(strikes, price);
  const ws = calcWingStep(strikes, atmIdx);

  // Clamp-safe strike accessor by offset from ATM
  const s = (offset: number): number =>
    strikes[Math.max(0, Math.min(strikes.length - 1, atmIdx + offset))];

  const nearExp = expirations[0];
  // For strategies needing a far expiry, pick ~4 expirations out (or the last one available)
  const farExp = expirations[Math.min(3, expirations.length - 1)];

  const leg = (
    strike: number,
    type: OptionType,
    expiration: string,
    side: Side,
    size = 1,
  ): LegTemplate => ({ strike, type, expiration, side, size, price: 0 });

  switch (strategyName) {
    // ── Single-leg ────────────────────────────────────────────────────────────

    case "Long Call":
      // Buy ATM Call
      return [leg(s(0), "Call", nearExp, "Long")];

    case "Long Put":
      // Buy ATM Put
      return [leg(s(0), "Put", nearExp, "Long")];

    case "Short Call":
      // Sell OTM Call (1 wing above ATM)
      return [leg(s(ws), "Call", nearExp, "Short")];

    case "Short Put":
      // Sell OTM Put (1 wing below ATM)
      return [leg(s(-ws), "Put", nearExp, "Short")];

    // ── Two-leg, same expiry ──────────────────────────────────────────────────

    case "Bull Call Spread":
      // Long ATM Call, Short OTM Call
      return [
        leg(s(0),   "Call", nearExp, "Long"),
        leg(s(ws),  "Call", nearExp, "Short"),
      ];

    case "Bear Put Spread":
      // Long higher Put, Short lower Put
      return [
        leg(s(0),   "Put", nearExp, "Long"),
        leg(s(-ws), "Put", nearExp, "Short"),
      ];

    case "Bull Put Spread":
      // Sell near-ATM Put, Buy further OTM Put
      return [
        leg(s(-ws),      "Put", nearExp, "Short"),
        leg(s(-2 * ws),  "Put", nearExp, "Long"),
      ];

    case "Bear Call Spread":
      // Sell near-ATM Call, Buy further OTM Call
      return [
        leg(s(ws),      "Call", nearExp, "Short"),
        leg(s(2 * ws),  "Call", nearExp, "Long"),
      ];

    case "Long Straddle":
      // Buy ATM Call + ATM Put
      return [
        leg(s(0), "Call", nearExp, "Long"),
        leg(s(0), "Put",  nearExp, "Long"),
      ];

    case "Short Straddle":
      // Sell ATM Call + ATM Put
      return [
        leg(s(0), "Call", nearExp, "Short"),
        leg(s(0), "Put",  nearExp, "Short"),
      ];

    case "Long Strangle":
      // Buy OTM Call above ATM, Buy OTM Put below ATM
      return [
        leg(s(ws),  "Call", nearExp, "Long"),
        leg(s(-ws), "Put",  nearExp, "Long"),
      ];

    case "Short Strangle":
      // Sell OTM Call above ATM, Sell OTM Put below ATM
      return [
        leg(s(ws),  "Call", nearExp, "Short"),
        leg(s(-ws), "Put",  nearExp, "Short"),
      ];

    // ── Two-leg, different expiry ─────────────────────────────────────────────

    case "Calendar Spread":
      // Sell near-term ATM Call, Buy far-term ATM Call
      return [
        leg(s(0), "Call", nearExp, "Short"),
        leg(s(0), "Call", farExp,  "Long"),
      ];

    case "Diagonal Spread":
      // Sell near-term OTM Call, Buy far-term ATM Call
      return [
        leg(s(ws), "Call", nearExp, "Short"),
        leg(s(0),  "Call", farExp,  "Long"),
      ];

    // ── Four-leg ──────────────────────────────────────────────────────────────

    case "Iron Condor":
      // A < B < [ATM] < C < D
      // Sell Put B (1 wing below), Buy Put A (2 wings below)
      // Sell Call C (1 wing above), Buy Call D (2 wings above)
      return [
        leg(s(-ws),      "Put",  nearExp, "Short"),  // B
        leg(s(-2 * ws),  "Put",  nearExp, "Long"),   // A
        leg(s(ws),       "Call", nearExp, "Short"),  // C
        leg(s(2 * ws),   "Call", nearExp, "Long"),   // D
      ];

    case "Iron Butterfly":
      // Buy OTM Put A, Sell ATM Put B, Sell ATM Call B, Buy OTM Call C
      return [
        leg(s(-ws), "Put",  nearExp, "Long"),   // A
        leg(s(0),   "Put",  nearExp, "Short"),  // B
        leg(s(0),   "Call", nearExp, "Short"),  // B
        leg(s(ws),  "Call", nearExp, "Long"),   // C
      ];

    case "Long Butterfly":
      // Buy A, Sell 2×B, Buy C  (A < B < C equidistant)
      return [
        leg(s(-ws), "Call", nearExp, "Long",  1),
        leg(s(0),   "Call", nearExp, "Short", 2),
        leg(s(ws),  "Call", nearExp, "Long",  1),
      ];

    case "Condor":
      // Long Call Condor: Buy A, Sell B, Sell C, Buy D
      return [
        leg(s(-2 * ws), "Call", nearExp, "Long"),
        leg(s(-ws),     "Call", nearExp, "Short"),
        leg(s(ws),      "Call", nearExp, "Short"),
        leg(s(2 * ws),  "Call", nearExp, "Long"),
      ];

    case "Double Diagonal":
      // Put diagonal + Call diagonal
      // Buy far Put A, Sell near Put B, Sell near Call C, Buy far Call D
      return [
        leg(s(-2 * ws), "Put",  farExp,  "Long"),
        leg(s(-ws),     "Put",  nearExp, "Short"),
        leg(s(ws),      "Call", nearExp, "Short"),
        leg(s(2 * ws),  "Call", farExp,  "Long"),
      ];

    default:
      return [];
  }
}
