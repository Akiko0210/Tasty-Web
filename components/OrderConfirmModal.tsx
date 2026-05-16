"use client";

import type { Order, DryRunResult } from "@/lib/types";

const shortDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

interface OrderConfirmModalProps {
  order: Order;
  dryRun: DryRunResult;
  isSubmitting: boolean;
  submitError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function NetCost({ totalCost }: { totalCost: number }) {
  const abs = Math.abs(totalCost / 100);
  const isCredit = totalCost > 0;
  return (
    <span
      className={`text-2xl font-bold tabular-nums ${
        isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {isCredit ? "+" : "-"}${abs.toFixed(2)}{" "}
      <span className="text-base font-semibold opacity-70">
        {isCredit ? "cr" : "db"}
      </span>
    </span>
  );
}

export function OrderConfirmModal({
  order,
  dryRun,
  isSubmitting,
  submitError,
  onConfirm,
  onCancel,
}: OrderConfirmModalProps) {
  const fees = Number(dryRun["fee-calculation"]?.["total-fees"] ?? 0);
  const bpChange = Number(dryRun["buying-power-effect"]?.["change-in-buying-power"] ?? 0);
  const bpEffect = dryRun["buying-power-effect"]?.effect;
  const warnings = dryRun.warnings ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal card */}
      <div className="relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-black bg-white shadow-2xl dark:border-white dark:bg-black">

        {/* Header */}
        <div className="border-b-2 border-black px-5 py-4 dark:border-white">
          <p className="text-xs font-bold uppercase tracking-widest opacity-50">
            Review Order
          </p>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="rounded border-2 border-black px-2 py-0.5 text-sm font-bold dark:border-white">
              {order.symbol}
            </span>
            <span className="text-lg font-bold">{order.strategyName}</span>
          </div>
        </div>

        {/* Legs table — scrollable if many legs or narrow screen */}
        <div className="overflow-x-auto overflow-y-auto px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/20 dark:border-white/20">
                <th className="pb-1.5 text-left text-xs font-bold uppercase tracking-wider opacity-50">
                  Side
                </th>
                <th className="pb-1.5 text-left text-xs font-bold uppercase tracking-wider opacity-50">
                  Type
                </th>
                <th className="pb-1.5 text-right text-xs font-bold uppercase tracking-wider opacity-50">
                  Strike
                </th>
                <th className="pb-1.5 pl-4 text-left text-xs font-bold uppercase tracking-wider opacity-50">
                  Expiry
                </th>
                <th className="pb-1.5 text-right text-xs font-bold uppercase tracking-wider opacity-50">
                  Qty
                </th>
                <th className="pb-1.5 text-right text-xs font-bold uppercase tracking-wider opacity-50">
                  Mid
                </th>
              </tr>
            </thead>
            <tbody>
              {order.legs.map((leg) => (
                <tr
                  key={leg.id}
                  className="border-b border-black/10 last:border-0 dark:border-white/10"
                >
                  <td className="py-2">
                    <span
                      className={`font-bold ${
                        leg.side === "Long"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {leg.side === "Long" ? "BTO" : "STO"}
                    </span>
                  </td>
                  <td className="py-2 font-medium">{leg.type}</td>
                  <td className="py-2 text-right font-mono font-bold">{leg.strike}</td>
                  <td className="py-2 pl-4 font-mono text-xs opacity-60">{shortDate(leg.expiration)}</td>
                  <td className="py-2 text-right font-mono">×{leg.size}</td>
                  <td className="py-2 text-right font-mono">
                    {leg.price > 0 ? leg.price.toFixed(2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mx-5 mb-3 rounded border-2 border-yellow-500 bg-yellow-50 px-3 py-2 dark:bg-yellow-950/30">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                ⚠ {w.message}
              </p>
            ))}
          </div>
        )}

        {/* Dry-run stats */}
        <div className="border-t border-black/20 px-5 py-3 dark:border-white/20">
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-60">TIF</span>
            <span className="font-mono font-medium">{order.tif}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="opacity-60">Fees</span>
            <span className="font-mono font-medium">
              {fees > 0 ? `$${fees.toFixed(2)}` : "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="opacity-60">Buying power</span>
            <span
              className={`font-mono font-medium ${
                bpEffect === "Credit"
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {bpEffect === "Credit" ? "+" : "-"}${bpChange.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Net cost */}
        <div className="flex items-center justify-between border-t-2 border-black px-5 py-4 dark:border-white">
          <span className="text-sm font-bold uppercase tracking-wider opacity-60">
            Net premium
          </span>
          <NetCost totalCost={order.totalCost} />
        </div>

        {/* Submit error — may be multi-line (one per failed preflight check) */}
        {submitError && (
          <div className="mx-5 mb-3 rounded border-2 border-red-500 bg-red-50 px-3 py-2 dark:bg-red-950/30">
            {submitError.split("\n").map((line, i) => (
              <p key={i} className="text-xs font-medium text-red-700 dark:text-red-300">
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 border-t-2 border-black px-5 py-4 dark:border-white">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border-2 border-black px-4 py-2.5 text-sm font-bold transition hover:bg-black/10 disabled:opacity-40 dark:border-white dark:hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border-2 border-black bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black/80 disabled:opacity-40 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {isSubmitting ? "Placing…" : "Confirm Order"}
          </button>
        </div>

      </div>
    </div>
  );
}
