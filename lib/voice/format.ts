import type { Leg, Order } from "@/lib/types";

// Helpers that turn ticket/order data into natural spoken sentences. Kept pure
// so they're easy to reason about and reuse from both the page and the agent.

export function money(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

// Make tickers pronounceable: index/letter symbols are spelled out, a few common
// names are spoken naturally.
const SPOKEN: Record<string, string> = {
  SPX: "S P X",
  SPY: "S P Y",
  QQQ: "triple Q",
  AAPL: "Apple",
  NVDA: "Nvidia",
  TSLA: "Tesla",
  AMZN: "Amazon",
  MSFT: "Microsoft",
  "/ES": "E S futures",
  "/MES": "Micro E S futures",
};

export function spokenSymbol(sym: string): string {
  if (SPOKEN[sym]) return SPOKEN[sym];
  const core = sym.replace(/^\//, "");
  // Spell out short all-caps tickers so TTS doesn't slur them into a word.
  if (/^[A-Z]{1,5}$/.test(core)) return core.split("").join(" ");
  return sym;
}

// Bid/Mid/Ask credit-or-debit rule, matching the on-screen Bid/Mid/Ask row:
// the bid measures sell proceeds (positive → credit), mid/ask measure buy cost.
export function netLabel(val: number, sellSide: boolean): { amount: number; effect: "credit" | "debit" } {
  const isCredit = sellSide ? val >= 0 : val < 0;
  return { amount: Math.abs(val), effect: isCredit ? "credit" : "debit" };
}

const MONTHS_SHORT = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function spokenDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${MONTHS_SHORT[Number(m[2]) - 1]} ${Number(m[3])}`;
}

function plural(word: string, n: number): string {
  return n === 1 ? word : `${word}s`;
}

// "buy 2 puts at 5950"
export function describeLeg(leg: Leg): string {
  const verb = leg.side === "Long" ? "buy" : "sell";
  const type = plural(leg.type.toLowerCase(), leg.size);
  return `${verb} ${leg.size} ${type} at ${leg.strike}`;
}

// Full readout of a freshly built / current ticket.
export function describeTicket(strategyName: string, symbol: string, legs: Leg[]): string {
  if (!legs.length) return `The ${strategyName} ticket has no legs.`;
  const allSameExp = legs.every((l) => l.expiration === legs[0].expiration);
  const legText = legs.map(describeLeg).join(", ");
  const expText = allSameExp
    ? `, expiring ${spokenDate(legs[0].expiration)}`
    : `, with mixed expirations`;
  return `${strategyName} on ${spokenSymbol(symbol)}: ${legText}${expText}.`;
}

// One order line for the monitoring readout. Fetched orders use the convention
// where a credit nets negative totalCost (see api/fetchOrders + OrdersView).
export function describeOrder(o: Order, index?: number): string {
  const isCredit = o.totalCost <= 0;
  const amount = Math.abs(o.totalCost / 100);
  const prefix = index != null ? `${index}. ` : "";
  return `${prefix}${spokenSymbol(o.symbol)} ${o.strategyName}, ${o.status.toLowerCase()}, limit ${money(
    amount,
  )} ${isCredit ? "credit" : "debit"}.`;
}
