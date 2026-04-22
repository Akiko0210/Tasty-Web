"use client";

import { useState, useEffect, useMemo } from "react";
import type { Leg, Order, OptionType, Side } from "@/lib/types";
import { strategyConfigs, SYMBOLS, UNDERLYING_QUOTE_SYMBOL } from "@/lib/constants";
import { toLegs, calculateTotalCost, legToSymbol, buildStrategyLegs, buildOrderPayload } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import type { Symbol } from "@/lib/constants";
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
  const realStrikes = chain?.strikes ?? [];
  const chainExpirations = chain?.expirations ?? [];
  const strikesByExpiration = chain?.strikesByExpiration ?? {};
  const optionChainStatus = chain?.status ?? "loading";
  const optionChainError = chain?.error ?? null;

  // Fetch chain for selected symbol (no-op if already cached)
  useEffect(() => {
    fetchOptionChainForSymbol(selectedSymbol);
  }, [selectedSymbol, fetchOptionChainForSymbol]);

  const strategyKey = selected !== null ? `${selectedSymbol}-${selected}` : null;
  const legs = strategyKey ? (legsByStrategy[strategyKey] ?? []) : [];
  const totalCost = calculateTotalCost(legs);

  const underlyingQuoteSymbol = UNDERLYING_QUOTE_SYMBOL[selectedSymbol];
  const underlyingQuote = quotes[underlyingQuoteSymbol];
  const currentPrice = underlyingQuote?.last ?? null;

  const legSymbols = useMemo(
    () => legs.flatMap((leg) => { const sym = legToSymbol(leg, selectedSymbol); return sym ? [sym] : []; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [legs.map((l) => legToSymbol(l, selectedSymbol)).join(",")],
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
            realStrikes,
            chainExpirations,
            currentPrice,
          ),
        );
        return { ...prev, [strategyKey]: newLegs };
      });
    }
  }, [strategyKey, optionChainStatus, realStrikes, chainExpirations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fill in mid price for legs that haven't been priced yet
  useEffect(() => {
    if (!strategyKey) return;
    setLegsByStrategy((prev) => {
      const list = prev[strategyKey];
      if (!list?.length) return prev;
      let changed = false;
      const updated = list.map((leg) => {
        if (leg.price !== 0) return leg;
        const sym = legToSymbol(leg, selectedSymbol);
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
    if (!strategyKey) return;
    setLegsByStrategy((prev) => {
      const list = prev[strategyKey] ?? [];
      return { ...prev, [strategyKey]: list.map((l) => (l.id === legId ? { ...l, ...updates } : l)) };
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
    const atmStrike =
      realStrikes.length && currentPrice != null
        ? realStrikes.reduce((best, s) =>
            Math.abs(s - currentPrice) < Math.abs(best - currentPrice) ? s : best,
          )
        : (realStrikes[Math.floor(realStrikes.length / 2)] ?? 0);
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
      const payload = buildOrderPayload(legs, selectedSymbol, totalCost, tif);
      const dryRun = await dryRunOrder(payload);
      const order: Order = {
        id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
        symbol: selectedSymbol,
        strategyName: strategyConfigs[selected].name,
        status: "Working",
        orderNumber: `#${Math.floor(100000000 + Math.random() * 900000000)}`,
        tif,
        legs: legs.map((l) => ({ ...l, daysToExpiry: l.daysToExpiry ?? 16 })),
        createdAt: new Date(),
        totalCost,
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
        </header>

        {/* ── Mobile card list (< sm) ──────────────────────────────────────── */}
        <div className="sm:hidden divide-y-2 divide-black/10 dark:divide-white/10">
          {legs.map((leg) => {
            const sym = legToSymbol(leg, selectedSymbol);
            const quote = sym ? quotes[sym] : undefined;
            return (
              <LegCard
                key={leg.id}
                leg={leg}
                onUpdate={(updates) => updateLeg(leg.id, updates)}
                onRemove={() => removeLeg(leg.id)}
                bid={quote?.bid}
                ask={quote?.ask}
                strikes={realStrikes}
                expirations={chainExpirations}
                strikesByExpiration={strikesByExpiration}
                rootSymbol={selectedSymbol}
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
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Bid</th>
                <th className="px-4 py-3">Ask</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {legs.map((leg) => {
                const sym = legToSymbol(leg, selectedSymbol);
                const quote = sym ? quotes[sym] : undefined;
                return (
                  <LegRow
                    key={leg.id}
                    leg={leg}
                    onUpdate={(updates) => updateLeg(leg.id, updates)}
                    onRemove={() => removeLeg(leg.id)}
                    bid={quote?.bid}
                    ask={quote?.ask}
                    strikes={realStrikes}
                    expirations={chainExpirations}
                    strikesByExpiration={strikesByExpiration}
                    rootSymbol={selectedSymbol}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addPosition}
                className="rounded-lg border-2 border-dashed border-black px-4 py-2 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
              >
                + New position
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
            {/* Total */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium opacity-80">Total:</span>
              <span
                className={`text-lg font-bold ${
                  totalCost >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {totalCost >= 0 ? "+" : ""}${totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
    </>
  );
}
