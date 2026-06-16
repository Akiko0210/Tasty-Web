import type { Leg, OptionType, Side, OrderPayload } from "./types";
import { strategyConfigs } from "./constants";

export function strategyToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function slugToStrategyIndex(slug: string): number {
  return strategyConfigs.findIndex((s) => strategyToSlug(s.name) === slug);
}

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

// Full TastyTrade action string for a leg (BTO/STO/BTC/STC).
export function legAction(
  leg: Pick<Leg, "side" | "openClose">,
): "Buy to Open" | "Sell to Open" | "Buy to Close" | "Sell to Close" {
  const isClose = leg.openClose === "Close";
  return leg.side === "Long"
    ? isClose ? "Buy to Close" : "Buy to Open"
    : isClose ? "Sell to Close" : "Sell to Open";
}

// Short action code for display (BTO/STO/BTC/STC).
export function legActionCode(
  leg: Pick<Leg, "side" | "openClose">,
): "BTO" | "STO" | "BTC" | "STC" {
  const isClose = leg.openClose === "Close";
  return leg.side === "Long"
    ? isClose ? "BTC" : "BTO"
    : isClose ? "STC" : "STO";
}

// Looks up the dxFeed streamer symbol for a leg from the option chain symbol map.
export function legToSymbol(
  leg: Leg,
  symbolMap: Record<string, { occ: string; streamer: string }>,
): string | null {
  const cp = leg.type === "Call" ? "C" : "P";
  return symbolMap[`${leg.expiration}|${leg.strike}|${cp}`]?.streamer ?? null;
}

// Builds the TastyTrade API order payload from the current legs.
// netPrice < 0 = net debit; netPrice > 0 = net credit (per-share, from calculateTotalCost).
// Throws if any leg has price === 0 (quotes not loaded yet).
export function buildOrderPayload(
  legs: Leg[],
  symbolMap: Record<string, { occ: string; streamer: string }>,
  netPrice: number,
  tif: "Day" | "GTC" = "Day",
): OrderPayload {
  const unpricedCount = legs.filter((l) => l.price === 0).length;
  if (unpricedCount > 0) {
    throw new Error(
      `${unpricedCount} leg${unpricedCount > 1 ? "s have" : " has"} no price yet — wait for quotes to load or enter prices manually.`,
    );
  }

  const priceEffect: "Credit" | "Debit" = netPrice > 0 ? "Credit" : "Debit";

  return {
    "time-in-force": tif,
    "order-type": "Limit",
    price: Math.abs(netPrice).toFixed(2),
    "price-effect": priceEffect,
    legs: legs.map((leg) => {
      const cp = leg.type === "Call" ? "C" : "P";
      const occ = symbolMap[`${leg.expiration}|${leg.strike}|${cp}`]?.occ ?? "";
      return {
        "instrument-type": occ.startsWith("./") ? "Future Option" : "Equity Option",
        symbol: occ,
        quantity: leg.size,
        action: legAction(leg),
      };
    }),
  };
}

// Returns per-share net price summed across legs (positive = credit, negative = debit).
export function calculateTotalCost(legs: Leg[]): number {
  return legs.reduce((total, leg) => {
    const cost = leg.price * leg.size;
    return total + (leg.side === "Long" ? -cost : cost);
  }, 0);
}

// Returns the closest available strike for a new expiration.
export function resolveStrikeOnExpChange(
  newExp: string,
  currentStrike: number,
  strikesByExpiration: Record<string, number[]> | undefined,
): number {
  const newStrikes = strikesByExpiration?.[newExp] ?? [];
  if (newStrikes.includes(currentStrike)) return currentStrike;
  if (!newStrikes.length) return currentStrike;
  return newStrikes.reduce((best, s) =>
    Math.abs(s - currentStrike) < Math.abs(best - currentStrike) ? s : best,
  );
}

// Returns the available expiration closest to a target ISO date. Used by the
// voice agent to snap a spoken date onto a real, tradable expiration.
export function nearestExpiration(targetIso: string, expirations: string[]): string {
  if (!expirations.length) return targetIso;
  const target = new Date(targetIso + "T00:00:00").getTime();
  if (isNaN(target)) return expirations[0];
  return expirations.reduce((best, exp) => {
    const dExp = Math.abs(new Date(exp + "T00:00:00").getTime() - target);
    const dBest = Math.abs(new Date(best + "T00:00:00").getTime() - target);
    return dExp < dBest ? exp : best;
  });
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
  strikesByExpiration: Record<string, number[]>,
  expirations: string[],
  currentPrice: number | null,
): LegTemplate[] {
  const nearExp = expirations[0];
  const nearStrikes = nearExp ? (strikesByExpiration[nearExp] ?? []) : [];
  if (!nearStrikes.length || !expirations.length) return [];

  const price = currentPrice ?? nearStrikes[Math.floor(nearStrikes.length / 2)];
  const atmIdx = findAtmIndex(nearStrikes, price);
  const ws = calcWingStep(nearStrikes, atmIdx);

  // Clamp-safe strike accessor by offset from ATM (near-exp strikes)
  const s = (offset: number): number =>
    nearStrikes[Math.max(0, Math.min(nearStrikes.length - 1, atmIdx + offset))];

  // Snap a target price to the closest available strike for a given expiration
  const closestIn = (exp: string, target: number): number => {
    const expStrikes = strikesByExpiration[exp] ?? [];
    if (!expStrikes.length) return target;
    return expStrikes.reduce((best, strike) =>
      Math.abs(strike - target) < Math.abs(best - target) ? strike : best,
    );
  };

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
        leg(s(0),                    "Call", nearExp, "Short"),
        leg(closestIn(farExp, s(0)), "Call", farExp,  "Long"),
      ];

    case "Diagonal Spread":
      // Sell near-term OTM Call, Buy far-term ATM Call
      return [
        leg(s(ws),                   "Call", nearExp, "Short"),
        leg(closestIn(farExp, s(0)), "Call", farExp,  "Long"),
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
        leg(closestIn(farExp, s(-2 * ws)), "Put",  farExp,  "Long"),
        leg(s(-ws),                        "Put",  nearExp, "Short"),
        leg(s(ws),                         "Call", nearExp, "Short"),
        leg(closestIn(farExp, s(2 * ws)),  "Call", farExp,  "Long"),
      ];

    default:
      return [];
  }
}
