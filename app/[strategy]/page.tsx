"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Leg, Order, OptionType, Side } from "@/lib/types";
import { strategyConfigs, UNDERLYING_QUOTE_SYMBOL, FUTURES_SYMBOLS, FUTURES_MULTIPLIER } from "@/lib/constants";
import { toLegs, calculateTotalCost, legToSymbol, buildStrategyLegs, buildOrderPayload, resolveStrikeOnExpChange, nearestExpiration, strategyToSlug, slugToStrategyIndex } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useRegisterVoiceTicket } from "@/contexts/VoiceContext";
import type { VoiceTicketApi, VoiceTicketState, VoiceResult } from "@/lib/voice/types";
import { describeTicket, money, spokenSymbol } from "@/lib/voice/format";
import type { FuturesContract } from "@/contexts/AppContext";
import { MULTI_EXPIRY_STRATEGIES } from "@/lib/constants";
import type { OrderPayload, DryRunResult } from "@/lib/types";
import { dryRunOrder, submitOrder } from "@/api/placeOrder";
import { replaceOrder } from "@/api/replaceOrder";
import { StrategyDropdown } from "@/components/StrategyDropdown";
import { LegRow, LegCard } from "@/components/LegRow";
import { OrderConfirmModal } from "@/components/OrderConfirmModal";

export default function StrategyPage() {
  const params = useParams<{ strategy: string }>();
  const router = useRouter();
  const urlStrategyIdx = slugToStrategyIndex(params.strategy);

  const {
    balance,
    setBalance,
    selected,
    setSelected,
    chainCache,
    fetchOptionChainForSymbol,
    quotes,
    setQuoteSymbols,
    watchlist,
    prefilledOrder,
    setPrefilledOrder,
  } = useApp();

  // URL is the source of truth — fall back to it immediately so there's no blank flash on refresh
  const effectiveSelected = selected ?? (urlStrategyIdx >= 0 ? urlStrategyIdx : null);

  // Symbol — persisted to localStorage; validated against watchlist once it loads
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    if (typeof window === "undefined") return "SPX";
    try {
      return localStorage.getItem("tasty-symbol") ?? "SPX";
    } catch { return "SPX"; }
  });

  // When watchlist loads, fall back to the first symbol if the stored one isn't there
  useEffect(() => {
    if (watchlist.length > 0 && !watchlist.includes(selectedSymbol)) {
      setSelectedSymbol(watchlist[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  const [selectedContract, setSelectedContract] = useState<string | null>(null);

  // Legs — persisted to localStorage
  const [legsByStrategy, setLegsByStrategy] = useState<Record<string, Leg[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const s = localStorage.getItem("tasty-legs");
      return s ? (JSON.parse(s) as Record<string, Leg[]>) : {};
    } catch { return {}; }
  });

  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState<boolean>(false);
  const [showLegPrices, setShowLegPrices] = useState(false);
  const [orderPriceOverride, setOrderPriceOverride] = useState<string | null>(null);

  // Prefill state (from Similar / Opposite / Replace on orders page)
  const [pendingPrefillLegs, setPendingPrefillLegs] = useState<Leg[] | null>(null);
  const [replaceOrderId, setReplaceOrderId] = useState<string | null>(null);

  // Order confirmation flow
  const [tif, setTif] = useState<"Day" | "GTC">("Day");
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<{
    order: Order;
    payload: OrderPayload;
    dryRun: DryRunResult;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync URL slug → AppContext.selected (handles refresh + back/forward navigation)
  useEffect(() => {
    if (urlStrategyIdx >= 0) setSelected(urlStrategyIdx);
  }, [urlStrategyIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist symbol to localStorage
  useEffect(() => {
    localStorage.setItem("tasty-symbol", selectedSymbol);
  }, [selectedSymbol]);

  // Persist legs to localStorage
  useEffect(() => {
    if (Object.keys(legsByStrategy).length > 0)
      localStorage.setItem("tasty-legs", JSON.stringify(legsByStrategy));
  }, [legsByStrategy]);

  const chain = chainCache[selectedSymbol];
  const strikesByExpiration = chain?.strikesByExpiration ?? {};
  const symbolMap = chain?.symbolMap ?? {};
  const optionChainStatus = chain?.status ?? "loading";
  const optionChainError = chain?.error ?? null;

  // Futures contract selector — show only the 4 nearest unexpired contracts
  const futuresContracts: FuturesContract[] = chain?.futuresContracts ?? [];
  const expirationToContract = chain?.expirationToContract ?? {};
  const today = new Date().toISOString().slice(0, 10);
  const upcomingContracts = futuresContracts
    .filter((c) => c.expirationDate >= today)
    .slice(0, 4);
  const activeContract =
    selectedContract ??
    futuresContracts.find((c) => c.isActive)?.symbol ??
    (upcomingContracts[0]?.symbol ?? null);

  // For futures: filter expirations to those settling into the selected contract
  const chainExpirations = useMemo(() => {
    const all = chain?.expirations ?? [];
    if (!FUTURES_SYMBOLS.has(selectedSymbol) || !activeContract) return all;
    return all.filter((exp) => expirationToContract[exp] === activeContract);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain?.expirations, selectedSymbol, activeContract, expirationToContract]);

  // For futures: use selected contract's streamer symbol for the underlying quote
  const selectedContractData = futuresContracts.find((c) => c.symbol === activeContract);

  // Fetch chain for selected symbol (no-op if already cached)
  useEffect(() => {
    fetchOptionChainForSymbol(selectedSymbol);
  }, [selectedSymbol, fetchOptionChainForSymbol]);

  // Reset contract selection when switching symbols
  useEffect(() => {
    setSelectedContract(null);
  }, [selectedSymbol]);

  const strategyKey =
    effectiveSelected !== null
      ? `${selectedSymbol}-${activeContract ?? ""}-${effectiveSelected}`
      : null;
  const legs = strategyKey ? (legsByStrategy[strategyKey] ?? []) : [];
  const totalCost = calculateTotalCost(legs);

  // Reset price override and dry-run error when switching strategies or symbols
  useEffect(() => {
    setOrderPriceOverride(null);
    setDryRunError(null);
  }, [strategyKey]);

  const underlyingQuoteSymbol =
    selectedContractData?.streamerSymbol ??
    chain?.underlyingStreamerSymbol ??
    UNDERLYING_QUOTE_SYMBOL[selectedSymbol as keyof typeof UNDERLYING_QUOTE_SYMBOL] ??
    selectedSymbol;
  const underlyingQuote = quotes[underlyingQuoteSymbol];
  const currentPrice = underlyingQuote?.last ?? null;

  // For call legs, derive price via put-call parity when dxFeed call quotes are stale
  // (market makers pull call quotes after large index moves; puts stay fresh).
  function getEffectiveQuote(leg: Leg): { bid: number; ask: number } | undefined {
    const sym = legToSymbol(leg, symbolMap);
    const directQ = sym ? quotes[sym] : undefined;
    if (leg.type !== "Call" || currentPrice === null) return directQ;
    const putSym = symbolMap[`${leg.expiration}|${leg.strike}|P`]?.streamer;
    const putQ = putSym ? quotes[putSym] : undefined;
    if (!putQ) return directQ;
    const T = Math.max(0, (new Date(leg.expiration + "T16:00:00").getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000));
    const parityAdj = currentPrice * Math.exp(-0.013 * T) - leg.strike * Math.exp(-0.05 * T);
    const parityBid = putQ.bid + parityAdj;
    const parityAsk = putQ.ask + parityAdj;
    if (!directQ) return { bid: Math.max(0, parityBid), ask: Math.max(0, parityAsk) };
    const parityMid = (parityBid + parityAsk) / 2;
    const directMid = (directQ.bid + directQ.ask) / 2;
    if (Math.abs(directMid - parityMid) > 5) return { bid: Math.max(0, parityBid), ask: Math.max(0, parityAsk) };
    return directQ;
  }

  // Per docs/Tastytrade_Pricing_Logic_Instruction.md:
  //   Ask (price to BUY)  = Σ Long@Ask − Σ Short@Bid   (natural price, worst fills when buying)
  //   Bid (price to SELL) = paired-vertical optimization when any leg is crossed;
  //                         falls back to Σ Long@Bid − Σ Short@Ask in normal markets.
  // Sign in this "long-positive" convention: positive = debit-natured, negative = credit-natured.
  const calcSide = (longUsesAsk: boolean) =>
    legs.reduce((sum, leg) => {
      const q = getEffectiveQuote(leg);
      if (!q) return NaN;
      const isShort = leg.side === "Short";
      const price = isShort
        ? (longUsesAsk ? q.bid : q.ask)
        : (longUsesAsk ? q.ask : q.bid);
      return sum + (isShort ? -price : price) * leg.size;
    }, 0);

  // Tastytrade spread-optimization bid: decomposes into paired verticals and for each pair
  // uses Long@Ask - Short@Ask (debit vertical) or Long@Ask - Short@Bid (credit vertical).
  // This captures inversions in crossed legs, producing an inverted quote when warranted.
  const calcOptimizedBid = (): number => {
    const hasCrossed = legs.some(leg => {
      const q = getEffectiveQuote(leg);
      return q ? q.bid > q.ask : false;
    });
    if (!hasCrossed) return calcSide(false);

    const longUnits: Array<{ q: { bid: number; ask: number }; mid: number }> = [];
    const shortUnits: Array<{ q: { bid: number; ask: number }; mid: number }> = [];
    for (const leg of legs) {
      const q = getEffectiveQuote(leg);
      if (!q) return NaN;
      const mid = (q.bid + q.ask) / 2;
      const arr = leg.side === "Long" ? longUnits : shortUnits;
      for (let i = 0; i < leg.size; i++) arr.push({ q, mid });
    }
    if (!longUnits.length || !shortUnits.length) return calcSide(false);

    const pairCount = Math.min(longUnits.length, shortUnits.length);
    let sum = 0;
    for (let i = 0; i < pairCount; i++) {
      const lu = longUnits[i], su = shortUnits[i];
      // Debit vertical (long mid >= short mid): Long@Ask - Short@Ask
      // Credit vertical (long mid < short mid): Long@Ask - Short@Bid
      sum += lu.q.ask - (lu.mid >= su.mid ? su.q.ask : su.q.bid);
    }
    // Unmatched units when total long qty ≠ total short qty
    for (let i = pairCount; i < longUnits.length; i++) sum += longUnits[i].q.bid;
    for (let i = pairCount; i < shortUnits.length; i++) sum -= shortUnits[i].q.ask;
    return sum;
  };

  const totalAsk = calcSide(true);       // long@ask, short@bid (unchanged)
  const totalBid = calcOptimizedBid();   // paired-vertical optimization
  const totalMid =
    isNaN(totalBid) || isNaN(totalAsk) ? NaN : (totalBid + totalAsk) / 2;

  // Direction (credit/debit) is fixed by mid price; user only types the magnitude.
  // totalMid uses long-positive convention; cashflow convention (used by buildOrderPayload)
  // is the opposite sign, so flip when projecting Mid → order price.
  const directionSign = isNaN(totalMid)
    ? totalCost >= 0 ? 1 : -1
    : totalMid <= 0 ? 1 : -1;

  const parsedOverride = orderPriceOverride !== null ? parseFloat(orderPriceOverride) : NaN;
  const basePrice = !isNaN(totalMid) ? -totalMid : totalCost;
  const effectiveTotalCost = isNaN(parsedOverride)
    ? basePrice
    : directionSign * Math.abs(parsedOverride);

  const legSymbols = useMemo(
    () => legs.flatMap((leg) => {
      const sym = legToSymbol(leg, symbolMap);
      const syms: string[] = sym ? [sym] : [];
      if (leg.type === "Call") {
        const putSym = symbolMap[`${leg.expiration}|${leg.strike}|P`]?.streamer;
        if (putSym) syms.push(putSym);
      }
      return syms;
    }),
    // symbolMap must be a dep: legs are restored from localStorage before the
    // chain loads, so without it the memo stays stuck at [] (empty symbolMap)
    // and the leg quotes are never subscribed on a cold first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [legs.map((l) => `${l.expiration}|${l.strike}|${l.type}`).join(","), symbolMap],
  );

  useEffect(() => {
    setQuoteSymbols([underlyingQuoteSymbol, ...legSymbols]);
  }, [underlyingQuoteSymbol, legSymbols, setQuoteSymbols]);

  // Apply prefilled order (from Similar / Opposite / Replace on orders page)
  useEffect(() => {
    if (!prefilledOrder) return;

    const sym =
      watchlist.find(
        (s) => prefilledOrder.symbol === s || prefilledOrder.symbol.startsWith(s),
      ) ?? watchlist[0] ?? "SPX";
    setSelectedSymbol(sym);

    const stratIdx = strategyConfigs.findIndex(
      (s) => s.name === prefilledOrder.strategyName,
    );
    setSelected(stratIdx >= 0 ? stratIdx : 0);
    setTif(prefilledOrder.tif);
    setOrderPriceOverride(Math.abs(prefilledOrder.totalCost / 100).toFixed(2));
    setReplaceOrderId(prefilledOrder.replaceOrderId ?? null);

    setPendingPrefillLegs(
      prefilledOrder.legs.map((l) => ({
        ...l,
        id: `leg-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        visible: true,
      })),
    );

    setPrefilledOrder(null);
  }, [prefilledOrder, setPrefilledOrder, setSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!strategyKey) return;

    if (pendingPrefillLegs) {
      setLegsByStrategy((prev) => ({ ...prev, [strategyKey]: pendingPrefillLegs }));
      setPendingPrefillLegs(null);
      return;
    }

    if (optionChainStatus === "ready") {
      setLegsByStrategy((prev) => {
        const cached = prev[strategyKey];
        if (cached?.length) {
          const earliestAvailable = chainExpirations[0];
          const hasExpired = earliestAvailable && cached.some((leg) => leg.expiration < earliestAvailable);
          if (!hasExpired) return prev;
        }
        const newLegs = toLegs(
          buildStrategyLegs(
            strategyConfigs[effectiveSelected!].name,
            strikesByExpiration,
            chainExpirations,
            currentPrice,
          ),
        );
        return { ...prev, [strategyKey]: newLegs };
      });
    }
  }, [strategyKey, optionChainStatus, pendingPrefillLegs, strikesByExpiration, chainExpirations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fill in mid price for legs that haven't been priced yet
  useEffect(() => {
    if (!strategyKey) return;
    setLegsByStrategy((prev) => {
      const list = prev[strategyKey];
      if (!list?.length) return prev;
      let changed = false;
      const updated = list.map((leg) => {
        if (leg.price !== 0) return leg;
        const quote = getEffectiveQuote(leg);
        if (!quote) return leg;
        const mid = (quote.bid + quote.ask) / 2;
        changed = true;
        return { ...leg, price: Math.round(mid * 100) / 100 };
      });
      return changed ? { ...prev, [strategyKey]: updated } : prev;
    });
  }, [quotes, strategyKey, selectedSymbol]);

  // ── Voice agent ticket API ──────────────────────────────────────────────────
  // The implementations close over the current render's state and setters and are
  // refreshed into a ref every render, so the stable `voiceApi` the global agent
  // holds always invokes the latest closures — no stale state, no re-registration.
  const voiceImplRef = useRef<{
    getState: () => VoiceTicketState;
    setSymbol: (s: string) => VoiceResult;
    buildStrategy: (a: { strategyName: string; optionType?: OptionType; strikes: number[]; expiration?: string }) => VoiceResult;
    setLimitPrice: (p: number) => VoiceResult;
    setTif: (t: "Day" | "GTC") => VoiceResult;
    setSize: (n: number) => VoiceResult;
    submit: () => Promise<VoiceResult>;
    confirm: () => Promise<VoiceResult>;
    cancelPending: () => VoiceResult;
  }>(null!);

  voiceImplRef.current = {
    getState: () => ({
      symbol: selectedSymbol,
      strategyName: effectiveSelected !== null ? strategyConfigs[effectiveSelected].name : null,
      legs,
      bid: totalBid,
      mid: totalMid,
      ask: totalAsk,
      limitPrice: Math.abs(effectiveTotalCost),
      limitEffect: directionSign >= 0 ? "credit" : "debit",
      tif,
      currentPrice,
      chainReady: optionChainStatus === "ready",
      expirations: chainExpirations,
      hasPending: pendingOrder !== null,
    }),

    setSymbol: (sym) => {
      if (watchlist.length && !watchlist.includes(sym)) {
        return { ok: false, message: `${spokenSymbol(sym)} isn't in your watchlist. Add it from the dashboard first.` };
      }
      setSelectedSymbol(sym);
      return { ok: true, message: `Switched to ${spokenSymbol(sym)}.` };
    },

    buildStrategy: ({ strategyName, optionType, strikes, expiration }) => {
      if (optionChainStatus !== "ready") {
        return { ok: false, message: `The option chain for ${spokenSymbol(selectedSymbol)} is still loading. Please try again in a moment.` };
      }
      const idx = strategyConfigs.findIndex((c) => c.name === strategyName);
      if (idx < 0) return { ok: false, message: `I don't know the strategy ${strategyName}.` };
      if (!chainExpirations.length) return { ok: false, message: "No expirations are available for this symbol." };

      const exp = expiration ? nearestExpiration(expiration, chainExpirations) : chainExpirations[0];
      // Chosen expiration goes first: single-expiry strategies build entirely on
      // it, multi-expiry strategies use it as their near leg.
      const reordered = [exp, ...chainExpirations.filter((e) => e !== exp)];
      const template = buildStrategyLegs(strategyName, strikesByExpiration, reordered, currentPrice);
      if (!template.length) return { ok: false, message: `I couldn't build a ${strategyName} right now.` };

      const multiExpiry = MULTI_EXPIRY_STRATEGIES.has(strategyName);
      const mixedType =
        strategyName === "Iron Condor" || strategyName === "Iron Butterfly" || strategyName === "Double Diagonal";
      const expFor = (leg: { expiration: string }) => (multiExpiry ? leg.expiration : exp);

      // Map spoken strikes onto the template. Single-expiry strategies align by
      // ascending strike (lowest spoken → lowest leg) so each leg keeps its role;
      // otherwise apply positionally.
      const strikeByIndex: Record<number, number> = {};
      if (strikes.length && !multiExpiry) {
        const order = template.map((l, i) => ({ i, strike: l.strike })).sort((a, b) => a.strike - b.strike);
        const sorted = [...strikes].sort((a, b) => a - b);
        order.forEach((o, rank) => {
          const k = sorted[rank] ?? sorted[sorted.length - 1];
          strikeByIndex[o.i] = resolveStrikeOnExpChange(exp, k, strikesByExpiration);
        });
      } else {
        template.forEach((l, i) => {
          const k = strikes[i];
          strikeByIndex[i] = k != null ? resolveStrikeOnExpChange(expFor(l), k, strikesByExpiration) : l.strike;
        });
      }

      const newLegs = toLegs(
        template.map((leg, i) => ({
          ...leg,
          expiration: expFor(leg),
          strike: strikeByIndex[i],
          type: optionType && !mixedType ? optionType : leg.type,
          price: 0,
        })),
      );

      const key = `${selectedSymbol}-${activeContract ?? ""}-${idx}`;
      setSelected(idx);
      setOrderPriceOverride(null);
      setDryRunError(null);
      setLegsByStrategy((prev) => ({ ...prev, [key]: newLegs }));
      return { ok: true, message: describeTicket(strategyName, selectedSymbol, newLegs) };
    },

    setLimitPrice: (price) => {
      if (!isFinite(price)) return { ok: false, message: "I didn't catch the limit price." };
      if (!strategyKey || !legs.length) return { ok: false, message: "There's no active order to price." };
      setOrderPriceOverride(Math.abs(price).toFixed(2));
      return { ok: true, message: `Limit price set to ${money(price)} ${directionSign >= 0 ? "credit" : "debit"}.` };
    },

    setTif: (t) => {
      setTif(t);
      return { ok: true, message: `Time in force set to ${t === "GTC" ? "good til cancelled" : "day"}.` };
    },

    setSize: (n) => {
      if (!strategyKey || !legs.length) return { ok: false, message: "There's no active order." };
      if (!Number.isFinite(n) || n < 1) return { ok: false, message: "Quantity must be at least one." };
      const minSize = Math.min(...legs.map((l) => l.size)) || 1;
      setOrderPriceOverride(null);
      setLegsByStrategy((prev) => {
        const list = prev[strategyKey] ?? [];
        return { ...prev, [strategyKey]: list.map((l) => ({ ...l, size: Math.max(1, Math.round((l.size / minSize) * n)) })) };
      });
      return { ok: true, message: `Quantity set to ${n}.` };
    },

    submit: async () => {
      if (!strategyKey || legs.length === 0 || effectiveSelected === null) {
        return { ok: false, message: "There's no active strategy order to place." };
      }
      try {
        const payload = buildOrderPayload(legs, symbolMap, effectiveTotalCost, tif);
        const dryRun = await dryRunOrder(payload);
        const order: Order = {
          id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
          symbol: selectedSymbol,
          strategyName: strategyConfigs[effectiveSelected].name,
          status: "Working",
          orderNumber: `#${Math.floor(100000000 + Math.random() * 900000000)}`,
          tif,
          legs: legs.map((l) => ({ ...l, daysToExpiry: l.daysToExpiry ?? 16 })),
          updatedAt: new Date(),
          totalCost: effectiveTotalCost * (FUTURES_MULTIPLIER[selectedSymbol] ?? 100),
        };
        setPendingOrder({ order, payload, dryRun });
        const premium = `${money(order.totalCost / 100)} ${order.totalCost > 0 ? "credit" : "debit"}`;
        const fees = Number(dryRun["fee-calculation"]?.["total-fees"] ?? 0);
        const bpChange = Number(dryRun["buying-power-effect"]?.["change-in-buying-power"] ?? 0);
        const warnings = dryRun.warnings ?? [];
        const parts = [
          `Ready to place ${order.strategyName} on ${spokenSymbol(selectedSymbol)} for ${premium}.`,
          `Buying power effect ${money(bpChange)}.`,
        ];
        if (fees > 0) parts.push(`Fees ${money(fees)}.`);
        if (warnings.length) parts.push(`Warning: ${warnings.map((w) => w.message).join("; ")}.`);
        parts.push("Say confirm to place it, or cancel.");
        return { ok: true, message: parts.join(" ") };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "The dry run failed." };
      }
    },

    confirm: async () => {
      if (!pendingOrder) return { ok: false, message: "There's no order waiting for confirmation." };
      try {
        if (replaceOrderId) {
          await replaceOrder(replaceOrderId, pendingOrder.payload);
          setReplaceOrderId(null);
        } else {
          await submitOrder(pendingOrder.payload);
        }
        setBalance((prev: number) => prev + pendingOrder.order.totalCost);
        const name = pendingOrder.order.strategyName;
        setPendingOrder(null);
        return { ok: true, message: `Order placed. Your ${name} is working.` };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Order submission failed." };
      }
    },

    cancelPending: () => {
      setPendingOrder(null);
      setSubmitError(null);
      return { ok: true, message: "Order cancelled." };
    },
  };

  const voiceApi = useMemo<VoiceTicketApi>(
    () => ({
      getState: () => voiceImplRef.current.getState(),
      setSymbol: (s) => voiceImplRef.current.setSymbol(s),
      buildStrategy: (a) => voiceImplRef.current.buildStrategy(a),
      setLimitPrice: (p) => voiceImplRef.current.setLimitPrice(p),
      setTif: (t) => voiceImplRef.current.setTif(t),
      setSize: (n) => voiceImplRef.current.setSize(n),
      submit: () => voiceImplRef.current.submit(),
      confirm: () => voiceImplRef.current.confirm(),
      cancelPending: () => voiceImplRef.current.cancelPending(),
    }),
    [],
  );
  useRegisterVoiceTicket(voiceApi);

  if (optionChainStatus === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent dark:border-white dark:border-t-transparent" />
          <p className="text-sm font-medium opacity-70">Loading option chain…</p>
        </div>
      </div>
    );
  }

  if (optionChainStatus === "error") {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border-2 border-red-600 bg-white p-8 shadow-lg dark:border-red-400 dark:bg-black">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400">
              Failed to load option chain
            </h2>
          </div>
          <p className="mb-2 text-sm opacity-80">
            Option chain data is required to use this page. The API returned an error:
          </p>
          <pre className="mb-6 whitespace-pre-wrap break-all rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {optionChainError ?? "Unknown error"}
          </pre>
          <button
            type="button"
            onClick={() => fetchOptionChainForSymbol(selectedSymbol)}
            className="w-full rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-black/80 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (effectiveSelected === null) return null;

  function updateLeg(legId: string, updates: Partial<Leg>) {
    if (!strategyKey || effectiveSelected === null) return;
    setOrderPriceOverride(null);
    setDryRunError(null);
    const strategyName = strategyConfigs[effectiveSelected].name;
    const syncExpiry =
      updates.expiration !== undefined && !MULTI_EXPIRY_STRATEGIES.has(strategyName);

    // Edited "Close" legs keep their closing action even if they no longer
    // match an opened position — the dry run surfaces a warning for those.
    setLegsByStrategy((prev) => {
      const list = prev[strategyKey] ?? [];
      const syncType =
        updates.type !== undefined &&
        list.length > 1 &&
        list.every((l) => l.type === list[0].type);

      return {
        ...prev,
        [strategyKey]: list.map((l) => {
          if (l.id === legId) return { ...l, ...updates };
          let next = { ...l };
          if (syncExpiry) {
            const newExp = updates.expiration!;
            next = { ...next, expiration: newExp, strike: resolveStrikeOnExpChange(newExp, l.strike, strikesByExpiration) };
          }
          if (syncType) next = { ...next, type: updates.type! };
          return next;
        }),
      };
    });
  }

  function removeLeg(legId: string) {
    if (!strategyKey) return;
    setOrderPriceOverride(null);
    setDryRunError(null);
    setLegsByStrategy((prev) => {
      const list = (prev[strategyKey] ?? []).filter((l) => l.id !== legId);
      return { ...prev, [strategyKey]: list };
    });
  }

  function addPosition() {
    if (!strategyKey) return;
    setOrderPriceOverride(null);
    setDryRunError(null);
    const list = legsByStrategy[strategyKey] ?? [];
    const last = list[list.length - 1];
    const nearStrikes = strikesByExpiration[chainExpirations[0]] ?? [];
    const atmStrike =
      nearStrikes.length && currentPrice != null
        ? nearStrikes.reduce((best, s) =>
            Math.abs(s - currentPrice) < Math.abs(best - currentPrice) ? s : best,
          )
        : (nearStrikes[Math.floor(nearStrikes.length / 2)] ?? 0);
    const base = last
      ? { ...last, strike: last.strike + 2, price: Math.max(0.5, last.price - 0.5) }
      : {
          strike: atmStrike,
          type: "Call" as OptionType,
          expiration: chainExpirations[0] ?? "",
          side: "Long" as Side,
          size: 1,
          price: 0,
        };
    const newLeg: Leg = {
      ...base,
      id: `leg-${Math.random().toString(36).substring(2, 9)}-${list.length}`,
      visible: true,
      status: "Working",
      daysToExpiry: 16,
      // A freshly added leg has no opened position behind it — always opens.
      openClose: "Open",
    };
    setLegsByStrategy((prev) => ({
      ...prev,
      [strategyKey]: [...(prev[strategyKey] ?? []), newLeg],
    }));
  }

  async function handleAddOrder() {
    if (!strategyKey || legs.length === 0 || effectiveSelected === null) return;
    setDryRunError(null);
    setIsDryRunning(true);
    try {
      const payload = buildOrderPayload(legs, symbolMap, effectiveTotalCost, tif);
      const dryRun = await dryRunOrder(payload);
      const order: Order = {
        id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        symbol: selectedSymbol,
        strategyName: strategyConfigs[effectiveSelected].name,
        status: "Working",
        orderNumber: `#${Math.floor(100000000 + Math.random() * 900000000)}`,
        tif,
        legs: legs.map((l) => ({ ...l, daysToExpiry: l.daysToExpiry ?? 16 })),
        updatedAt: new Date(),
        totalCost: effectiveTotalCost * (FUTURES_MULTIPLIER[selectedSymbol] ?? 100),
      };
      setPendingOrder({ order, payload, dryRun });
    } catch (err) {
      setDryRunError(err instanceof Error ? err.message : "Dry-run failed");
    } finally {
      setIsDryRunning(false);
    }
  }

  async function handleConfirmOrder() {
    if (!pendingOrder) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (replaceOrderId) {
        await replaceOrder(replaceOrderId, pendingOrder.payload);
        setReplaceOrderId(null);
      } else {
        await submitOrder(pendingOrder.payload);
      }
      setBalance((prev: number) => prev + pendingOrder.order.totalCost);
      setPendingOrder(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStrategySelect(idx: number) {
    router.push(`/${strategyToSlug(strategyConfigs[idx].name)}`);
  }

  return (
    <>
    {pendingOrder && (
      <OrderConfirmModal
        order={pendingOrder.order}
        dryRun={pendingOrder.dryRun}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onConfirm={handleConfirmOrder}
        onCancel={() => { setPendingOrder(null); setSubmitError(null); }}
        confirmLabel={replaceOrderId ? "Replace Order" : "Confirm Order"}
      />
    )}
    <div className="p-3 sm:p-6">
      {/* Symbol selector + price — above the card */}
      <div className="mx-auto mb-1 flex w-full max-w-4xl items-center gap-3">
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setSymbolDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded border-2 border-black px-3 py-1.5 text-sm font-bold hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
          >
            <span>{selectedSymbol}</span>
            <span className="opacity-70">▾</span>
          </button>
          {symbolDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setSymbolDropdownOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-32 rounded-lg border-2 border-black bg-white shadow-[0_8px_32px_rgba(0,0,0,0.22)] dark:border-white dark:bg-neutral-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                {watchlist.map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => { setSelectedSymbol(sym); setSymbolDropdownOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm font-medium ${
                      sym === selectedSymbol
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "hover:bg-black/10 dark:hover:bg-white/10"
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-sm font-bold">
          {currentPrice != null ? currentPrice.toFixed(2) : "—"}
        </span>
      </div>

      {/* Contract selector — own row so it doesn't crowd the symbol/price on mobile */}
      {FUTURES_SYMBOLS.has(selectedSymbol) && upcomingContracts.length > 0 && (
        <div className="mx-auto mb-2 flex w-full max-w-4xl flex-wrap items-center gap-1.5 sm:mb-3">
          {upcomingContracts.map((contract) => (
            <button
              key={contract.symbol}
              type="button"
              onClick={() => setSelectedContract(contract.symbol)}
              className={`min-h-10 touch-manipulation rounded border-2 px-3 py-2 text-xs font-bold transition ${
                activeContract === contract.symbol
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/30 hover:border-black dark:border-white/30 dark:hover:border-white"
              }`}
            >
              {contract.displayName}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
        <header className="flex items-center justify-between border-b-2 border-black px-4 py-3 dark:border-white">
          <div className="flex items-center gap-4">
            <StrategyDropdown
              strategies={strategyConfigs}
              selected={effectiveSelected}
              isOpen={dropdownOpen}
              onToggle={() => setDropdownOpen(!dropdownOpen)}
              onSelect={handleStrategySelect}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowLegPrices((p) => !p)}
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider opacity-50 hover:opacity-100"
          >
            Leg prices {showLegPrices ? "▲" : "▼"}
          </button>
        </header>

        {/* ── Bid / Mid / Ask — always visible, above legs ──────────────────── */}
        <div className="flex items-start justify-center gap-8 border-b-2 border-black/10 px-4 py-3 dark:border-white/10">
          {[
            { label: "Bid", val: totalBid, sellSide: true },
            { label: "Mid", val: totalMid, sellSide: false },
            { label: "Ask", val: totalAsk, sellSide: false },
          ].map(({ label, val, sellSide }) => {
            // Bid measures sell proceeds (positive → credit received); Mid/Ask
            // measure buy cost (positive → debit paid).
            const isCredit = sellSide ? val >= 0 : val < 0;
            return (
              <div key={label} className="flex flex-col items-center gap-0">
                <span className="text-xs font-bold uppercase tracking-wider opacity-50">{label}</span>
                <span className="font-mono text-sm font-bold">
                  {isNaN(val) ? "—" : `$${Math.abs(val).toFixed(2)}`}
                </span>
                {!isNaN(val) && (
                  <span className="text-xs opacity-40">{isCredit ? "cr" : "db"}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Mobile card list (< sm) ──────────────────────────────────────── */}
        <div className="divide-y-2 divide-black/10 dark:divide-white/10 sm:hidden">
          {!showLegPrices && legs.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-black/10 px-3 py-1 dark:border-white/10">
              <span className="w-13 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">S/L</span>
              <span className="w-11 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Type</span>
              <span className="w-20 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Strike</span>
              <span className="w-20 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Expiry</span>
              <span className="w-12 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Size</span>
            </div>
          )}
          {legs.map((leg) => {
            const quote = getEffectiveQuote(leg);
            return (
              <LegCard
                key={leg.id}
                leg={leg}
                onUpdate={(updates) => updateLeg(leg.id, updates)}
                onRemove={() => removeLeg(leg.id)}
                bid={quote?.bid}
                ask={quote?.ask}
                expirations={chainExpirations}
                strikesByExpiration={strikesByExpiration}
                showPriceDetails={showLegPrices}
              />
            );
          })}
        </div>

        {/* ── Desktop table (sm+) ──────────────────────────────────────────── */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-140">
            <thead>
              <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
                <th className="px-4 py-3">Strike</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3">S/L</th>
                <th className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    Size
                    <span className="cursor-help opacity-70" title="Number of contracts">ⓘ</span>
                  </span>
                </th>
                {showLegPrices && (
                  <>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Bid</th>
                    <th className="px-4 py-3">Ask</th>
                  </>
                )}
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {legs.map((leg) => {
                const quote = getEffectiveQuote(leg);
                return (
                  <LegRow
                    key={leg.id}
                    leg={leg}
                    onUpdate={(updates) => updateLeg(leg.id, updates)}
                    onRemove={() => removeLeg(leg.id)}
                    bid={quote?.bid}
                    ask={quote?.ask}
                    expirations={chainExpirations}
                    strikesByExpiration={strikesByExpiration}
                    showPriceDetails={showLegPrices}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="border-t-2 border-black px-4 py-3 dark:border-white">
          {dryRunError && (
            <div className="mb-2 rounded border border-red-400 bg-red-50 px-3 py-1.5 dark:bg-red-950/30">
              {dryRunError.split("\n").map((line, i) => (
                <p key={i} className="text-xs font-medium text-red-700 dark:text-red-300">{line}</p>
              ))}
            </div>
          )}
          {/* Limit price — left-aligned, above action buttons */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-50">Limit price</span>
            <input
              type="number"
              step={0.01}
              value={orderPriceOverride ?? Math.abs(effectiveTotalCost).toFixed(2)}
              onChange={(e) => setOrderPriceOverride(e.target.value)}
              onBlur={() => {
                if (orderPriceOverride !== null && isNaN(parseFloat(orderPriceOverride))) {
                  setOrderPriceOverride(null);
                }
              }}
              className="w-28 rounded border-2 border-black bg-white px-2 py-1 text-sm font-bold dark:border-white dark:bg-black"
            />
            <span className="text-xs font-bold opacity-50">{directionSign >= 0 ? "cr" : "db"}</span>
            {FUTURES_SYMBOLS.has(selectedSymbol) && (
              <span className="text-xs font-bold opacity-40">
                × ${FUTURES_MULTIPLIER[selectedSymbol]}/pt
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addPosition}
              className="rounded-lg border-2 border-dashed border-black px-4 py-2 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
            >
              Add leg
            </button>
            {/* TIF toggle */}
            <div className="flex overflow-hidden rounded-lg border-2 border-black dark:border-white">
              {(["Day", "GTC"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTif(t)}
                  className={`px-3 py-2 text-sm font-bold transition ${
                    tif === t
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddOrder}
              disabled={isDryRunning || legs.length === 0}
              className="rounded-lg border-2 border-black bg-black px-6 py-2 text-sm font-bold text-white transition hover:bg-black/80 disabled:opacity-50 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              {isDryRunning ? "Checking…" : "Add Order"}
            </button>
          </div>
        </footer>
      </div>
    </div>
    </>
  );
}
