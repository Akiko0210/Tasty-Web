import type { StrategyConfig } from "./types";

export const SYMBOLS = ["SPX", "AAPL"] as const;
export type Symbol = (typeof SYMBOLS)[number];

// dxFeed quote symbol for each underlying (both are plain tickers, confirmed via API)
export const UNDERLYING_QUOTE_SYMBOL: Record<Symbol, string> = {
  SPX: "SPX",
  AAPL: "AAPL",
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
