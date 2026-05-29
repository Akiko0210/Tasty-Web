"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { UNDERLYING_QUOTE_SYMBOL } from "@/lib/constants";

function toStreamerSymbol(sym: string): string {
  return UNDERLYING_QUOTE_SYMBOL[sym as keyof typeof UNDERLYING_QUOTE_SYMBOL] ?? sym;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SearchResult {
  found: boolean;
  symbol?: string;
  description?: string;
}

export default function DashboardPage() {
  const { quotes, setQuoteSymbols, watchlist, saveWatchlist } = useApp();
  const [showInput, setShowInput] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to watchlist quotes while on this page
  useEffect(() => {
    if (watchlist.length === 0) return;
    setQuoteSymbols(watchlist.map(toStreamerSymbol));
  }, [watchlist, setQuoteSymbols]);

  // Focus input when shown
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  function removeSymbol(sym: string) {
    saveWatchlist(watchlist.filter((s) => s !== sym));
  }

  function addSymbol() {
    if (!result?.found || !result.symbol) return;
    if (!watchlist.includes(result.symbol)) {
      saveWatchlist([...watchlist, result.symbol]);
    }
    cancelSearch();
  }

  function cancelSearch() {
    setShowInput(false);
    setQuery("");
    setResult(null);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResult(null); return; }
    setIsSearching(true);
    setResult(null);
    fetch(`/api/search-symbols?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((r: SearchResult) => setResult(r))
      .catch(() => setResult({ found: false }))
      .finally(() => setIsSearching(false));
  }, []);

  function onQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    setResult(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancelSearch();
    if (e.key === "Enter") addSymbol();
  }

  return (
    <main className="min-h-screen pt-14 lg:pl-64 dark:bg-black">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-2xl font-black uppercase tracking-widest">Dashboard</h1>

        <div className="space-y-2">
          {watchlist.map((sym) => {
            const q = quotes[toStreamerSymbol(sym)];
            const price = q ? (q.last ?? (q.bid + q.ask) / 2) : null;

            return (
              <div
                key={sym}
                className="flex items-center justify-between rounded-lg border-2 border-black px-4 py-3 dark:border-white"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="font-black uppercase tracking-wide">{sym}</span>
                    <span className="text-lg font-bold tabular-nums">
                      {price !== null ? fmt(price) : "—"}
                    </span>
                  </div>
                  {q ? (
                    <p className="mt-0.5 text-xs opacity-50 tabular-nums">
                      {fmt(q.bid)} / {fmt(q.ask)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs opacity-30">waiting…</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeSymbol(sym)}
                  className="ml-4 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border-2 border-red-400 text-sm font-bold text-red-400"
                  aria-label={`Remove ${sym}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        {/* Search input row */}
        {showInput && (
          <div className="mt-2">
            <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={onQueryChange}
                onKeyDown={onKeyDown}
                placeholder="Symbol (e.g. AAPL)"
                className="min-w-0 flex-1 bg-transparent font-mono text-sm font-bold uppercase outline-none placeholder:normal-case placeholder:font-normal placeholder:opacity-40"
              />
              {isSearching && <span className="text-xs opacity-40">…</span>}
              <button
                type="button"
                onClick={cancelSearch}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 border-red-400 text-sm font-bold text-red-400"
              >
                ✕
              </button>
            </div>

            {result !== null && (
              <div className="mt-1 rounded-lg bg-neutral-200 dark:bg-neutral-800">
                {result.found ? (
                  <button
                    type="button"
                    onClick={addSymbol}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <span className="font-bold">{result.symbol}</span>
                      {result.description && (
                        <span className="ml-2 truncate text-sm opacity-60">{result.description}</span>
                      )}
                    </div>
                    <span className="flex-shrink-0 rounded border-2 border-black px-3 py-1 text-xs font-bold dark:border-white">
                      Add
                    </span>
                  </button>
                ) : (
                  <p className="text-sm opacity-50">Symbol not found</p>
                )}
              </div>
            )}
          </div>
        )}

        {!showInput && (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="mt-2 w-full rounded-lg border-2 border-black px-4 py-3 text-left text-sm font-bold opacity-40 transition hover:opacity-100 dark:border-white"
          >
            + Add symbol
          </button>
        )}
      </div>
    </main>
  );
}
