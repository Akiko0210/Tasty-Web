import type { OptionType, Leg } from "@/lib/types";

// ── Ticket API ────────────────────────────────────────────────────────────────
// The strategy page registers an object with these methods so the global agent
// can drive the order ticket without owning its (carefully tuned) local state.

export interface VoiceTicketState {
  symbol: string;
  strategyName: string | null;
  legs: Leg[];
  // Bid/Mid/Ask in the page's long-positive convention (matches the on-screen
  // Bid/Mid/Ask row). NaN when quotes haven't loaded.
  bid: number;
  mid: number;
  ask: number;
  limitPrice: number; // magnitude only
  limitEffect: "credit" | "debit";
  tif: "Day" | "GTC";
  currentPrice: number | null; // underlying last price
  chainReady: boolean;
  expirations: string[];
  hasPending: boolean; // an order is awaiting confirmation in the modal
}

export interface VoiceResult {
  ok: boolean;
  message: string; // spoken back to the user verbatim
}

export interface VoiceTicketApi {
  getState(): VoiceTicketState;
  setSymbol(symbol: string): VoiceResult;
  buildStrategy(args: {
    strategyName: string;
    optionType?: OptionType;
    strikes: number[];
    expiration?: string;
  }): VoiceResult;
  setLimitPrice(price: number): VoiceResult;
  setTif(tif: "Day" | "GTC"): VoiceResult;
  setSize(size: number): VoiceResult;
  submit(): Promise<VoiceResult>; // dry-run + open the confirm modal, return a spoken summary
  confirm(): Promise<VoiceResult>; // place the order that's awaiting confirmation
  cancelPending(): VoiceResult; // dismiss the confirm modal without placing
}

export interface VoiceOrdersFilter {
  status?: string;
  symbol?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface VoiceOrdersApi {
  setFilter(filter: VoiceOrdersFilter): VoiceResult;
}
