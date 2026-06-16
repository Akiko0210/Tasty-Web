import type { StrategyConfig } from "./types";

export const SYMBOLS = ["SPX", "AAPL", "/ES", "/MES"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const FUTURES_SYMBOLS = new Set<string>(["/ES", "/MES"]);

// Maps futures symbol to CME product code used in the chain and instruments API
export const FUTURES_PRODUCT_CODE: Record<string, string> = {
  "/ES": "ES",
  "/MES": "MES",
};

// Dollar value per 1-point move per contract (ES: $50, MES: $5)
export const FUTURES_MULTIPLIER: Record<string, number> = {
  "/ES": 50,
  "/MES": 5,
};

// dxFeed symbol overrides. Only needed when the dxFeed symbol differs from the Tastytrade symbol.
// Futures need an exchange suffix; equity indices use a leading dot (e.g. ".RUT").
// Regular equities (AAPL, NVDA, …) need no override — their tickers match dxFeed directly.
export const UNDERLYING_QUOTE_SYMBOL: Record<string, string> = {
  "/ES": "/ES:XCME",
  "/MES": "/MES:XCME",
};

// Strategies where each leg can have an independent expiration date.
// All other multi-leg strategies share a single expiration across all legs.
export const MULTI_EXPIRY_STRATEGIES = new Set([
  "Calendar Spread",
  "Diagonal Spread",
  "Double Diagonal",
]);

// Strategies where certain legs must share a strike price (see docs/identifyStrategy.md).
// Each inner array is a group of leg indices — positions in buildStrategyLegs order —
// that are locked together: editing the strike of any leg in the group moves the others
// (snapped to each leg's own expiration). Strategies absent here have all-distinct strikes.
export const STRIKE_LOCKED_GROUPS: Record<string, number[][]> = {
  "Long Straddle": [[0, 1]], // Call & Put both at the ATM strike
  "Short Straddle": [[0, 1]], // Call & Put both at the ATM strike
  "Calendar Spread": [[0, 1]], // near & far leg share the strike (differ only by expiry)
  "Iron Butterfly": [[1, 2]], // body: short Put & short Call at the middle strike B
};

export const strategyConfigs: StrategyConfig[] = [
  // Single leg
  { name: "Long Call" },
  { name: "Long Put" },
  { name: "Short Call" },
  { name: "Short Put" },
  // Two-leg, same expiry
  { name: "Bull Call Spread" },
  { name: "Bear Put Spread" },
  { name: "Bull Put Spread" },
  { name: "Bear Call Spread" },
  { name: "Long Straddle" },
  { name: "Short Straddle" },
  { name: "Long Strangle" },
  { name: "Short Strangle" },
  // Two-leg, different expiry
  { name: "Calendar Spread" },
  { name: "Diagonal Spread" },
  // Four-leg
  { name: "Iron Condor" },
  { name: "Iron Butterfly" },
  { name: "Long Butterfly" },
  { name: "Condor" },
  { name: "Double Diagonal" },
];
