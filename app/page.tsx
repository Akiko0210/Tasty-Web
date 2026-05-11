"use client";

import { useState, useEffect, useMemo } from "react";
import type { Leg, Order, OptionType, Side } from "@/lib/types";
import { strategyConfigs, SYMBOLS, UNDERLYING_QUOTE_SYMBOL } from "@/lib/constants";
import { toLegs, calculateTotalCost, legToSymbol, buildStrategyLegs, buildOrderPayload, resolveStrikeOnExpChange } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import type { Symbol } from "@/lib/constants";
import { MULTI_EXPIRY_STRATEGIES } from "@/lib/constants";
import type { OrderPayload, DryRunResult } from "@/lib/types";
import { dryRunOrder, submitOrder } from "@/api/placeOrder";
import { StrategyDropdown } from "../components/StrategyDropdown";
import { LegRow, LegCard } from "../components/LegRow";
import { OrderConfirmModal } from "../components/OrderConfirmModal";

export default function StrategyPanel() {
  const {
    balance,
    setBalance,
    selected,
    setSelected,
    chainCache,
    fetchOptionChainForSymbol,
    quotes,
    setQuoteSymbols,
  } = useApp();

  const [selectedSymbol, setSelectedSymbol] = useState<Symbol>(SYMBOLS[0]);
  const [legsByStrategy, setLegsByStrategy] = useState<Record<string, Leg[]>>({});
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState<boolean>(false);
  const [showLegPrices, setShowLegPrices] = useState(false);
  const [orderPriceOverride, setOrderPriceOverride] = useState<string | null>(null);

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

  const chain = chainCache[selectedSymbol];
  const chainExpirations = chain?.expirations ?? [];
  const strikesByExpiration = chain?.strikesByExpiration ?? {};
  const symbolMap = chain?.symbolMap ?? {};
  const optionChainStatus = chain?.status ?? "loading";
  const optionChainError = chain?.error ?? null;

  // Fetch chain for selected symbol (no-op if already cached)
  useEffect(() => {
    fetchOptionChainForSymbol(selectedSymbol);
  }, [selectedSymbol, fetchOptionChainForSymbol]);

  const strategyKey = selected !== null ? `${selectedSymbol}-${selected}` : null;
  const legs = strategyKey ? (legsByStrategy[strategyKey] ?? []) : [];
  const totalCost = calculateTotalCost(legs);

  // Reset price override when switching strategies
  useEffect(() => {
    setOrderPriceOverride(null);
  }, [strategyKey]);

  // Per-share bid/ask/mid net across all legs (NaN if any quote is missing)
  const totalBid = legs.reduce((sum, leg) => {
    const sym = legToSymbol(leg, symbolMap);
    const q = sym ? quotes[sym] : undefined;
    if (!q) return NaN;
    const c = q.bid * leg.size;
    return sum + (leg.side === "Long" ? -c : c);
  }, 0);
  const totalAsk = legs.reduce((sum, leg) => {
    const sym = legToSymbol(leg, symbolMap);
    const q = sym ? quotes[sym] : undefined;
    if (!q) return NaN;
    const c = q.ask * leg.size;
    return sum + (leg.side === "Long" ? -c : c);
  }, 0);

  const totalMid = isNaN(totalBid) || isNaN(totalAsk)
    ? NaN
    : (totalBid + totalAsk) / 2;

  // Direction (credit/debit) is fixed by mid price; user only types the magnitude.
  const directionSign = isNaN(totalMid)
    ? (totalCost >= 0 ? 1 : -1)
    : (totalMid >= 0 ? 1 : -1);

  const parsedOverride = orderPriceOverride !== null ? parseFloat(orderPriceOverride) : NaN;
  const effectiveTotalCost = isNaN(parsedOverride)
    ? totalCost
    : directionSign * Math.abs(parsedOverride);

  const underlyingQuoteSymbol = UNDERLYING_QUOTE_SYMBOL[selectedSymbol];
  const underlyingQuote = quotes[underlyingQuoteSymbol];
  const currentPrice = underlyingQuote?.last ?? null;

  const legSymbols = useMemo(
    () => legs.flatMap((leg) => { const sym = legToSymbol(leg, symbolMap); return sym ? [sym] : []; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [legs.map((l) => legToSymbol(l, symbolMap)).join(",")],
  );

  useEffect(() => {
    setQuoteSymbols([underlyingQuoteSymbol, ...legSymbols]);
  }, [underlyingQuoteSymbol, legSymbols, setQuoteSymbols]);

  useEffect(() => {
    if (strategyKey && optionChainStatus === "ready") {
      setLegsByStrategy((prev) => {
        if (prev[strategyKey]?.length) return prev;
        const newLegs = toLegs(
          buildStrategyLegs(
            strategyConfigs[selected!].name,
            strikesByExpiration,
            chainExpirations,
            currentPrice,
          ),
        );
        return { ...prev, [strategyKey]: newLegs };
      });
    }
  }, [strategyKey, optionChainStatus, strikesByExpiration, chainExpirations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fill in mid price for legs that haven't been priced yet
  useEffect(() => {
    if (!strategyKey) return;
    setLegsByStrategy((prev) => {
      const list = prev[strategyKey];
      if (!list?.length) return prev;
      let changed = false;
      const updated = list.map((leg) => {
        if (leg.price !== 0) return leg;
        const sym = legToSymbol(leg, symbolMap);
        const quote = sym ? quotes[sym] : undefined;
        if (!quote) return leg;
        const mid = (quote.bid + quote.ask) / 2;
        changed = true;
        return { ...leg, price: Math.round(mid * 100) / 100 };
      });
      return changed ? { ...prev, [strategyKey]: updated } : prev;
    });
  }, [quotes, strategyKey, selectedSymbol]);

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
          <pre className="mb-6 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300 break-all whitespace-pre-wrap">
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

  if (selected === null) return null;

  function updateLeg(legId: string, updates: Partial<Leg>) {
    if (!strategyKey || selected === null) return;
    const strategyName = strategyConfigs[selected].name;
    const syncExpiry =
      updates.expiration !== undefined && !MULTI_EXPIRY_STRATEGIES.has(strategyName);

    setLegsByStrategy((prev) => {
      const list = prev[strategyKey] ?? [];
      if (syncExpiry) {
        const newExp = updates.expiration!;
        return {
          ...prev,
          [strategyKey]: list.map((l) => {
            if (l.id === legId) {
              // Caller already resolved this leg's strike; apply all updates as-is.
              return { ...l, ...updates };
            }
            // Sync expiration and resolve the closest strike for every other leg.
            const newStrike = resolveStrikeOnExpChange(newExp, l.strike, strikesByExpiration);
            return { ...l, expiration: newExp, strike: newStrike };
          }),
        };
      }
      return {
        ...prev,
        [strategyKey]: list.map((l) => (l.id === legId ? { ...l, ...updates } : l)),
      };
    });
  }

  function removeLeg(legId: string) {
    if (!strategyKey) return;
    setLegsByStrategy((prev) => {
      const list = (prev[strategyKey] ?? []).filter((l) => l.id !== legId);
      return { ...prev, [strategyKey]: list };
    });
  }

  function addPosition() {
    if (!strategyKey) return;
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
    };
    setLegsByStrategy((prev) => ({
      ...prev,
      [strategyKey]: [...(prev[strategyKey] ?? []), newLeg],
    }));
  }

  async function handleAddOrder() {
    if (!strategyKey || legs.length === 0 || selected === null) return;
    setDryRunError(null);
    setIsDryRunning(true);
    try {
      const payload = buildOrderPayload(legs, symbolMap, effectiveTotalCost, tif);
      const dryRun = await dryRunOrder(payload);
      const order: Order = {
        id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        symbol: selectedSymbol,
        strategyName: strategyConfigs[selected].name,
        status: "Working",
        orderNumber: `#${Math.floor(100000000 + Math.random() * 900000000)}`,
        tif,
        legs: legs.map((l) => ({ ...l, daysToExpiry: l.daysToExpiry ?? 16 })),
        updatedAt: new Date(),
        totalCost: effectiveTotalCost * 100,
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
      await submitOrder(pendingOrder.payload);
      setBalance((prev: number) => prev + pendingOrder.order.totalCost);
      setPendingOrder(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Order submission failed");
    } finally {
      setIsSubmitting(false);
    }
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
      />
    )}
    <div className="p-3 sm:p-6">
      {/* Symbol selector + price — above the card */}
      <div className="mx-auto mb-2 w-full max-w-4xl flex items-center gap-3 sm:mb-3">
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
                {SYMBOLS.map((sym) => (
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

      <div className="mx-auto w-full max-w-4xl rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
        <header className="flex items-center justify-between border-b-2 border-black px-4 py-3 dark:border-white">
          <div className="flex items-center gap-4">
            <StrategyDropdown
              strategies={strategyConfigs}
              selected={selected}
              isOpen={dropdownOpen}
              onToggle={() => setDropdownOpen(!dropdownOpen)}
              onSelect={setSelected}
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
            { label: "Bid", val: totalBid },
            { label: "Mid", val: totalMid },
            { label: "Ask", val: totalAsk },
          ].map(({ label, val }) => (
            <div key={label} className="flex flex-col items-center gap-0">
              <span className="text-xs font-bold uppercase tracking-wider opacity-50">{label}</span>
              <span className="font-mono text-sm font-bold">
                {isNaN(val) ? "—" : `$${Math.abs(val).toFixed(2)}`}
              </span>
              {!isNaN(val) && (
                <span className="text-xs opacity-40">{val >= 0 ? "cr" : "db"}</span>
              )}
            </div>
          ))}
        </div>

        {/* ── Mobile card list (< sm) ──────────────────────────────────────── */}
        <div className="sm:hidden divide-y-2 divide-black/10 dark:divide-white/10">
          {!showLegPrices && legs.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-black/10 px-3 py-1 dark:border-white/10">
              <span className="w-[52px] shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">S/L</span>
              <span className="w-[44px] shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Type</span>
              <span className="w-20 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Strike</span>
              <span className="w-20 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Expiry</span>
              <span className="w-12 shrink-0 text-center text-xs font-bold uppercase tracking-wider opacity-40">Size</span>
            </div>
          )}
          {legs.map((leg) => {
            const sym = legToSymbol(leg, symbolMap);
            const quote = sym ? quotes[sym] : undefined;
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
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[560px]">
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
                const sym = legToSymbol(leg, symbolMap);
                const quote = sym ? quotes[sym] : undefined;
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
          <div className="mb-3 flex items-center gap-2">
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
              className="w-28 rounded border-2 border-black px-2 py-1 text-sm font-bold bg-white dark:border-white dark:bg-black"
            />
            <span className="text-xs font-bold opacity-50">{directionSign >= 0 ? "cr" : "db"}</span>
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
