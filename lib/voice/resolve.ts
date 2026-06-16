import { UNDERLYING_QUOTE_SYMBOL } from "@/lib/constants";

// Symbol normalisation for the voice agent. The LLM usually passes a clean ticker,
// but this maps spoken company names and letter-spellings ("apple", "n v d a") to
// tradable tickers and resolves the dxFeed streamer symbol for quote lookups.

const SYMBOL_ALIASES: Record<string, string> = {
  apple: "AAPL",
  aapl: "AAPL",
  spx: "SPX",
  "s and p": "SPX",
  "s & p": "SPX",
  es: "/ES",
  emini: "/ES",
  "e mini": "/ES",
  "e-mini": "/ES",
  mes: "/MES",
  "micro es": "/MES",
  "micro e mini": "/MES",
  spy: "SPY",
  qqq: "QQQ",
  nvidia: "NVDA",
  nvda: "NVDA",
  tesla: "TSLA",
  tsla: "TSLA",
  amazon: "AMZN",
  google: "GOOGL",
  microsoft: "MSFT",
  meta: "META",
  netflix: "NFLX",
};

export function resolveSymbol(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/[?.!,]+$/g, "").trim();
  if (!cleaned) return null;

  if (SYMBOL_ALIASES[cleaned]) return SYMBOL_ALIASES[cleaned];

  // Futures spoken as "slash e s" or "/es"
  const slash = cleaned.replace(/^slash\s+/, "/");
  const slashKey = slash.replace(/^\//, "");
  if (SYMBOL_ALIASES[slashKey]) return SYMBOL_ALIASES[slashKey];

  // Letter-spelled tickers: "n v d a" → "NVDA"
  const letters = cleaned.replace(/[^a-z ]/g, "").trim();
  if (/^([a-z]\s+){1,4}[a-z]$/.test(letters)) {
    return letters.replace(/\s+/g, "").toUpperCase();
  }

  // Only accept a single bare token as a raw ticker — never guess from a phrase.
  if (/\s/.test(cleaned)) return null;
  const token = cleaned.replace(/[^a-z/]/g, "");
  if (token.length >= 1 && token.length <= 5) return token.toUpperCase();

  return null;
}

// dxFeed streamer symbol for an underlying (mirrors the dashboard helper).
export function toStreamerSymbol(sym: string): string {
  return UNDERLYING_QUOTE_SYMBOL[sym as keyof typeof UNDERLYING_QUOTE_SYMBOL] ?? sym;
}
