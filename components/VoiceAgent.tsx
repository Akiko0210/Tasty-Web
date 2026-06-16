"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useApp, type Quote } from "@/contexts/AppContext";
import { useVoiceTicketRef, useVoiceOrdersRef } from "@/contexts/VoiceContext";
import type { VoiceTicketApi, VoiceTicketState } from "@/lib/voice/types";
import { resolveSymbol, toStreamerSymbol } from "@/lib/voice/resolve";
import { netLabel } from "@/lib/voice/format";
import {
  createRecognizer,
  speak,
  speechRecognitionSupported,
  stopSpeaking,
  type SpeechRecognitionLike,
} from "@/lib/voice/speech";
import { fetchOrders, mapTastyworksResponseToOrders } from "@/api/fetchOrders";
import { cancelOrder } from "@/api/cancelOrder";
import { strategyToSlug } from "@/lib/utils";

// ── Conversation types (kept local so the Anthropic SDK never bundles client-side) ──
interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface TextBlock {
  type: "text";
  text: string;
}
type ContentBlock = ToolUseBlock | TextBlock | { type: string; [k: string]: unknown };
interface VoiceMessage {
  role: "user" | "assistant";
  content: string | unknown[];
}

const MAX_HISTORY = 24;
const MAX_LOOP_STEPS = 8;
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const J = (obj: unknown) => JSON.stringify(obj);

function lastNDaysRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

function priceField(val: number, sellSide: boolean) {
  return isNaN(val) ? null : netLabel(val, sellSide);
}

function ticketStateForModel(s: VoiceTicketState) {
  return {
    symbol: s.symbol,
    strategyName: s.strategyName,
    legs: s.legs.map((l) => ({ side: l.side, type: l.type, strike: l.strike, size: l.size, expiration: l.expiration })),
    midPrice: priceField(s.mid, false),
    bid: priceField(s.bid, true),
    ask: priceField(s.ask, false),
    limitPrice: s.legs.length ? { amount: s.limitPrice, effect: s.limitEffect } : null,
    timeInForce: s.tif,
    underlyingPrice: s.currentPrice,
    chainReady: s.chainReady,
    hasPendingOrder: s.hasPending,
  };
}

function orderCostField(totalCostCents: number) {
  return { amount: Math.abs(totalCostCents / 100), effect: totalCostCents <= 0 ? "credit" : "debit" };
}

// Explains why voice input can't run, or null if it can. Checked on the client.
function speechUnavailableReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext)
    return "Voice needs a secure page. Open the app at http://localhost:3000 — not the network IP address.";
  if (!speechRecognitionSupported())
    return "Voice input isn't supported in this browser. Use Chrome, Edge, or Safari (Firefox and Brave don't support it).";
  return null;
}

// Render nothing until hydrated — speech APIs are browser-only.
const subscribeNoop = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

export function VoiceAgent() {
  const router = useRouter();
  const { quotes, addPinnedSymbol } = useApp();
  const ticketRef = useVoiceTicketRef();
  const ordersRef = useVoiceOrdersRef();

  const mounted = useIsClient();
  const [unavailableReason] = useState<string | null>(() => speechUnavailableReason());
  const supported = unavailableReason === null;
  const [enabled, setEnabled] = useState(false);
  const [interim, setInterim] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [busy, setBusy] = useState(false);

  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(false);
  const speakingRef = useRef(false);
  const busyRef = useRef(false);
  const permissionDeniedRef = useRef(false);
  const quotesRef = useRef<Record<string, Quote>>(quotes);
  const messagesRef = useRef<VoiceMessage[]>([]);
  const handleUtteranceRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  const respond = useCallback((text: string, opts?: { silent?: boolean }) => {
    setLastResponse(text);
    if (opts?.silent) return;
    speakingRef.current = true;
    speak(text, {
      onstart: () => {
        speakingRef.current = true;
      },
      onend: () => {
        speakingRef.current = false;
      },
    });
  }, []);

  // ── Tool helpers ──────────────────────────────────────────────────────────────
  const getPrice = useCallback(
    async (symbol: string): Promise<number | null> => {
      const streamer = toStreamerSymbol(symbol);
      let q = quotesRef.current[streamer];
      if (!q) {
        addPinnedSymbol(streamer);
        for (let i = 0; i < 20 && !q; i++) {
          await delay(150);
          q = quotesRef.current[streamer];
        }
      }
      if (!q) return null;
      return q.last ?? (q.bid + q.ask) / 2;
    },
    [addPinnedSymbol],
  );

  const ensureTicket = useCallback(
    async (slug = "long-call"): Promise<VoiceTicketApi | null> => {
      if (ticketRef.current) return ticketRef.current;
      router.push(`/${slug}`);
      for (let i = 0; i < 40 && !ticketRef.current; i++) await delay(100);
      return ticketRef.current;
    },
    [router, ticketRef],
  );

  const listOrdersData = useCallback(async (status?: string) => {
    const { startDate, endDate } = lastNDaysRange(30);
    const raw = await fetchOrders({ startDate, endDate });
    let orders = await mapTastyworksResponseToOrders(raw);
    if (status) orders = orders.filter((o) => o.status === status);
    orders.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return {
      count: orders.length,
      orders: orders.slice(0, 10).map((o) => ({
        orderNumber: o.orderNumber,
        symbol: o.symbol,
        strategy: o.strategyName,
        status: o.status,
        price: orderCostField(o.totalCost),
      })),
    };
  }, []);

  const cancelOrderTool = useCallback(async (orderNumber?: string, confirmed?: boolean) => {
    const { startDate, endDate } = lastNDaysRange(30);
    const raw = await fetchOrders({ startDate, endDate });
    const orders = await mapTastyworksResponseToOrders(raw);
    const working = orders
      .filter((o) => o.status === "Working")
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const target = orderNumber ? orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber) : working[0];
    if (!target) return { error: orderNumber ? `No order ${orderNumber} found.` : "There are no working orders to cancel." };
    if (target.status !== "Working") return { error: `Order ${target.orderNumber} is ${target.status} and can't be cancelled.` };
    const summary = { orderNumber: target.orderNumber, symbol: target.symbol, strategy: target.strategyName, price: orderCostField(target.totalCost) };
    if (!confirmed) return { needsConfirmation: true, order: summary };
    try {
      await cancelOrder(target.id);
      return { ok: true, cancelled: target.orderNumber };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Cancel failed." };
    }
  }, []);

  // ── Tool dispatch (runs Claude's chosen tool in the browser) ──────────────────
  const executeTool = useCallback(
    async (name: string, input: Record<string, unknown>): Promise<string> => {
      switch (name) {
        case "get_ticket_state": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket. The user should open a strategy first." });
          return J(ticketStateForModel(api.getState()));
        }
        case "build_strategy": {
          const args = input as { strategyName: string; optionType?: "Call" | "Put"; strikes?: number[]; expiration?: string };
          const api = await ensureTicket(strategyToSlug(args.strategyName));
          if (!api) return J({ error: "Couldn't open the strategy ticket." });
          let r = api.buildStrategy({ ...args, strikes: args.strikes ?? [] });
          for (let i = 0; i < 25 && !r.ok && /loading/i.test(r.message); i++) {
            await delay(200);
            const a = ticketRef.current;
            if (!a) break;
            r = a.buildStrategy({ ...args, strikes: args.strikes ?? [] });
          }
          return J(r);
        }
        case "set_limit_price": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(api.setLimitPrice(Number(input.price)));
        }
        case "set_tif": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(api.setTif(input.tif === "GTC" ? "GTC" : "Day"));
        }
        case "set_size": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(api.setSize(Math.round(Number(input.size))));
        }
        case "set_symbol": {
          const api = await ensureTicket();
          if (!api) return J({ error: "No active ticket." });
          const sym = resolveSymbol(String(input.symbol ?? "")) ?? String(input.symbol ?? "");
          return J(api.setSymbol(sym));
        }
        case "get_underlying_price": {
          const raw = input.symbol ? String(input.symbol) : ticketRef.current?.getState().symbol;
          if (!raw) return J({ error: "No symbol given and no active ticket." });
          const sym = resolveSymbol(raw) ?? raw;
          const price = await getPrice(sym);
          return price == null ? J({ error: `No price available for ${sym} right now.` }) : J({ symbol: sym, price });
        }
        case "submit_order": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(await api.submit());
        }
        case "confirm_order": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(await api.confirm());
        }
        case "cancel_pending_order": {
          const api = ticketRef.current;
          if (!api) return J({ error: "No active ticket." });
          return J(api.cancelPending());
        }
        case "list_orders":
          return J(await listOrdersData(input.status ? String(input.status) : undefined));
        case "cancel_order":
          return J(await cancelOrderTool(input.orderNumber ? String(input.orderNumber) : undefined, input.confirmed === true));
        case "filter_orders": {
          router.push("/orders");
          // Wait for the orders page to mount and register its API
          for (let i = 0; i < 40 && !ordersRef.current; i++) await delay(100);
          if (!ordersRef.current) return J({ error: "Orders page didn't load in time." });
          return J(ordersRef.current.setFilter({
            status: input.status as string | undefined,
            symbol: input.symbol as string | undefined,
            dateStart: input.dateStart as string | undefined,
            dateEnd: input.dateEnd as string | undefined,
          }));
        }
        case "navigate": {
          const to = input.to;
          const path =
            to === "orders"
              ? "/orders"
              : to === "positions"
                ? "/positions"
                : to === "dashboard"
                  ? "/dashboard"
                  : "/long-call";
          router.push(path);
          return J({ ok: true });
        }
        default:
          return J({ error: `Unknown tool: ${name}` });
      }
    },
    [cancelOrderTool, ensureTicket, getPrice, listOrdersData, ordersRef, router, ticketRef],
  );

  // ── Agentic loop: send transcript → run Claude's tool calls → speak the reply ──
  const runAgent = useCallback(
    async (userText: string) => {
      messagesRef.current.push({ role: "user", content: userText });
      // Trim to recent history, starting at a plain user turn (so we never cut a
      // tool_use/tool_result pair apart, which the API rejects).
      if (messagesRef.current.length > MAX_HISTORY) {
        let start = messagesRef.current.length - MAX_HISTORY;
        while (
          start < messagesRef.current.length &&
          !(messagesRef.current[start].role === "user" && typeof messagesRef.current[start].content === "string")
        ) {
          start++;
        }
        messagesRef.current = messagesRef.current.slice(start);
      }

      busyRef.current = true;
      setBusy(true);
      try {
        for (let step = 0; step < MAX_LOOP_STEPS; step++) {
          const res = await fetch("/api/voice-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messagesRef.current }),
          });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            const msg = body.error ?? "";
            respond(
              /ANTHROPIC_API_KEY/.test(msg)
                ? "The voice assistant isn't configured yet. An Anthropic API key needs to be added to the environment."
                : "Sorry, the assistant ran into an error. Please try again.",
            );
            return;
          }
          const data = (await res.json()) as { content: ContentBlock[]; stop_reason: string };
          messagesRef.current.push({ role: "assistant", content: data.content });

          const toolUses = data.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
          if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
            const text = data.content
              .filter((b): b is TextBlock => b.type === "text")
              .map((b) => b.text)
              .join(" ")
              .trim();
            respond(text || "Done.");
            return;
          }

          const results = [];
          for (const tu of toolUses) {
            const out = await executeTool(tu.name, tu.input ?? {});
            results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
          }
          messagesRef.current.push({ role: "user", content: results });
        }
        respond("Sorry, that took too many steps. Please try rephrasing.");
      } catch {
        respond("Sorry, I couldn't reach the assistant.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [executeTool, respond],
  );

  const handleUtterance = useCallback(
    (text: string) => {
      if (busyRef.current) return;
      stopSpeaking();
      setInterim("");
      setLastUserText(text);
      runAgent(text);
    },
    [runAgent],
  );

  useEffect(() => {
    handleUtteranceRef.current = handleUtterance;
  }, [handleUtterance]);

  // ── Recognizer lifecycle ──────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const reason = speechUnavailableReason();
    if (reason) {
      respond(reason);
      return;
    }
    if (permissionDeniedRef.current) {
      respond("Microphone access was denied. Enable it in your browser settings to use voice.");
      return;
    }
    if (!recognizerRef.current) {
      recognizerRef.current = createRecognizer({
        onFinal: (text) => {
          if (text) handleUtteranceRef.current(text);
        },
        onInterim: (text) => {
          if (text) stopSpeaking();
          setInterim(text);
        },
        onError: (err) => {
          if (err === "not-allowed" || err === "service-not-allowed") {
            permissionDeniedRef.current = true;
            enabledRef.current = false;
            setEnabled(false);
            respond("Microphone access was denied. Enable it in your browser settings to use voice.");
          }
        },
        onEnd: () => {
          if (enabledRef.current && !permissionDeniedRef.current) {
            try {
              recognizerRef.current?.start();
            } catch {
              /* already started */
            }
          }
        },
      });
    }
    if (!recognizerRef.current) {
      respond("Voice input isn't available in this browser.");
      return;
    }
    enabledRef.current = true;
    setEnabled(true);
    try {
      recognizerRef.current.start();
    } catch {
      /* already started */
    }
    respond("Voice on. I'm listening.");
  }, [respond]);

  const stopListening = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    stopSpeaking();
    try {
      recognizerRef.current?.stop();
    } catch {
      /* ignore */
    }
    setLastResponse("Voice off.");
  }, []);

  const toggle = useCallback(() => {
    if (enabledRef.current) stopListening();
    else startListening();
  }, [startListening, stopListening]);

  // Global hotkey: Alt+M toggles, Escape stops speech.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        stopSpeaking();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  useEffect(
    () => () => {
      stopSpeaking();
      try {
        recognizerRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  if (!mounted) return null;

  return (
    <section
      aria-label="Voice trading assistant"
      className="fixed bottom-4 right-4 z-[60] flex max-w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2"
    >
      {unavailableReason && (
        <div className="w-full rounded-xl border-2 border-yellow-500 bg-yellow-50 px-3 py-2 text-sm shadow-lg dark:bg-yellow-950/40">
          <p className="font-medium text-yellow-800 dark:text-yellow-300">{unavailableReason}</p>
        </div>
      )}

      {!unavailableReason && (lastUserText || lastResponse || interim || busy) && (
        <div className="w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm shadow-lg dark:border-white dark:bg-black">
          {lastUserText && (
            <p className="mb-1 truncate text-xs opacity-50">
              <span className="font-bold uppercase tracking-wider">You:</span> {lastUserText}
            </p>
          )}
          {interim && enabled && <p className="mb-1 text-xs italic opacity-40">{interim}…</p>}
          <p aria-live="polite" aria-atomic="true" className="font-medium">
            {busy ? "Thinking…" : lastResponse}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={
          supported
            ? enabled
              ? "Voice assistant on. Click or press Alt M to stop listening."
              : "Voice assistant off. Click or press Alt M to start listening."
            : "Voice assistant not supported in this browser."
        }
        disabled={!supported}
        title={supported ? "Voice assistant (Alt+M)" : "Voice not supported in this browser"}
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-xl transition-all duration-200 disabled:opacity-40 ${
          enabled
            ? "animate-pulse bg-red-500 shadow-red-500/40 hover:bg-red-600"
            : "bg-black hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke={enabled ? "white" : undefined}
          className={`h-7 w-7 ${enabled ? "" : "stroke-white dark:stroke-black"}`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
          <line x1="8" x2="16" y1="22" y2="22" />
        </svg>
      </button>
    </section>
  );
}
