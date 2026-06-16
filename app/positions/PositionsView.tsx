"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPositions, type Position } from "@/api/fetchPositions";

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en-US", { month: "short", day: "numeric" });
}

// "6990 C · Mar 27 · 12d" for options, "Shares" for equities.
function describe(p: Position): string {
  if (!p.isOption) return p.instrumentType.replace(/^Equity$/, "Shares");
  const parts = [`${p.strike} ${p.optionType === "Put" ? "P" : "C"}`];
  if (p.expiration) parts.push(shortDate(p.expiration));
  if (p.daysToExpiry != null) parts.push(`${p.daysToExpiry}d`);
  return parts.join(" · ");
}

function pnlClass(n: number): string {
  return n >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function QtyBadge({ p }: { p: Position }) {
  const isShort = p.direction === "Short";
  return (
    <span className={isShort ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
      {isShort ? "-" : "+"}
      {p.quantity} {p.direction}
    </span>
  );
}

export default function PositionsView() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPositions(await fetchPositions());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalValue = positions.reduce((sum, p) => sum + p.marketValue, 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white p-4 dark:bg-black sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-4 flex items-center justify-between sm:mb-6">
          <h1 className="text-xl font-bold sm:text-2xl">Positions</h1>
          <button
            type="button"
            onClick={load}
            className="rounded border-2 border-black px-3 py-1.5 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
          >
            Refresh
          </button>
        </div>

        {/* Summary */}
        {!loading && !error && positions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-6 rounded-xl border-2 border-black bg-white px-4 py-3 dark:border-white dark:bg-black sm:mb-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Open P/L</p>
              <p className={`text-lg font-bold tabular-nums ${pnlClass(totalPnl)}`}>{money(totalPnl)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Market Value</p>
              <p className="text-lg font-bold tabular-nums">{money(totalValue)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-50">Positions</p>
              <p className="text-lg font-bold tabular-nums">{positions.length}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">Loading positions…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
            <p className="font-medium text-red-700 dark:text-red-400">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded border-2 border-red-600 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-600 hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : positions.length === 0 ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">No open positions</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="rounded-xl border-2 border-black bg-white dark:border-white dark:bg-black sm:hidden">
              {positions.map((p) => (
                <div key={p.id} className="border-b border-black/20 px-4 py-3 last:border-b-0 dark:border-white/20">
                  <div className="flex items-center gap-2">
                    <span className="rounded border-2 border-black px-2 py-0.5 text-sm font-bold dark:border-white">
                      {p.underlying}
                    </span>
                    <span className="flex-1 text-sm font-medium">{describe(p)}</span>
                    <span className="text-sm font-bold">
                      <QtyBadge p={p} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-sm tabular-nums">
                    <span className="opacity-60">Avg {money(p.averageOpenPrice)}</span>
                    <span className="opacity-50">·</span>
                    <span className="opacity-60">Mark {money(p.markPrice)}</span>
                    <span className={`ml-auto font-bold ${pnlClass(p.unrealizedPnl)}`}>{money(p.unrealizedPnl)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black sm:block">
              <table className="w-full min-w-180">
                <thead>
                  <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3 text-right">Avg Open</th>
                    <th className="px-4 py-3 text-right">Mark</th>
                    <th className="px-4 py-3 text-right">Open P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b border-black/20 dark:border-white/20">
                      <td className="px-4 py-2 font-medium">{p.underlying}</td>
                      <td className="px-4 py-2 text-sm">{describe(p)}</td>
                      <td className="px-4 py-2 text-sm font-medium">
                        <QtyBadge p={p} />
                      </td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums">{money(p.averageOpenPrice)}</td>
                      <td className="px-4 py-2 text-right text-sm tabular-nums">{money(p.markPrice)}</td>
                      <td className={`px-4 py-2 text-right text-sm font-bold tabular-nums ${pnlClass(p.unrealizedPnl)}`}>
                        {money(p.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
