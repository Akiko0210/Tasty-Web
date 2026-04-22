import type { StrategyConfig } from "./types";

export const SYMBOLS = ["SPX", "AAPL"] as const;
export type Symbol = (typeof SYMBOLS)[number];

// dxFeed quote symbol for each underlying (both are plain tickers, confirmed via API)
export const UNDERLYING_QUOTE_SYMBOL: Record<Symbol, string> = {
  SPX: "SPX",
  AAPL: "AAPL",
};

// Strategies where each leg can have an independent expiration date.
// All other multi-leg strategies share a single expiration across all legs.
export const MULTI_EXPIRY_STRATEGIES = new Set([
  "Calendar Spread",
  "Diagonal Spread",
  "Double Diagonal",
]);

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
