"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Leg, Order } from "@/lib/types";
import { useApp } from "@/contexts/AppContext";
import { cancelOrder } from "@/api/cancelOrder";
import { strategyToSlug, legActionCode } from "@/lib/utils";
import { useRegisterVoiceOrders } from "@/contexts/VoiceContext";
import type { VoiceOrdersApi, VoiceOrdersFilter } from "@/lib/voice/types";

function formatLegDescription(leg: Leg): string {
  const qty = leg.side === "Long" ? leg.size : -leg.size;
  const d = leg.daysToExpiry ?? 0;
  return `${qty} ${leg.expiration} ${d}d ${leg.strike} ${leg.type[0]}`;
}

function formatPrice(totalCost: number): { text: string; isCredit: boolean } {
  const amount = totalCost / 100;
  const isCredit = totalCost <= 0;
  const display = isCredit
    ? `${Math.abs(amount).toFixed(2)}`
    : `-${amount.toFixed(2)}`;
  return { text: `LMT ${display} ${isCredit ? "cr" : "db"}`, isCredit };
}

function statusColor(status: string): string {
  switch (status) {
    case "Filled":
      return "border-blue-500 bg-blue-500 text-white";
    case "Working":
      return "border-yellow-500 bg-yellow-500 text-black";
    case "Cancelled":
      return "border-orange-500 bg-orange-500 text-white";
    case "Rejected":
      return "border-red-500 bg-red-500 text-white";
    case "Expired":
      return "border-gray-500 bg-gray-500 text-white";
    case "Received":
      return "border-sky-400 bg-sky-400 text-black";
    default:
      return "border-gray-400 bg-gray-400 text-white";
  }
}

const STATUS_FILTER_OPTIONS = [
  "All",
  "Filled",
  "Working",
  "Cancelled",
  "Rejected",
  "Expired",
  "Received",
];

function LegDescription({ leg }: { leg: Leg }) {
  const action = legActionCode(leg);
  const isSell = leg.side === "Short";
  return (
    <span className="font-mono text-xs">
      {formatLegDescription(leg)}{" "}
      <span
        className={
          isSell
            ? "text-red-600 dark:text-red-400"
            : "text-green-600 dark:text-green-400"
        }
      >
        {action}
      </span>
    </span>
  );
}

function OrderCard({
  order,
  mounted,
  onContextMenu,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  order: Order;
  mounted: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}) {
  const price = formatPrice(order.totalCost);
  return (
    <div
      className="select-none border-b border-black/20 px-4 py-3 dark:border-white/20"
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Row 1 — Symbol · Strategy · Status */}
      <div className="flex items-center gap-2">
        <span className="rounded border-2 border-black px-2 py-0.5 text-sm font-bold dark:border-white">
          {order.symbol}
        </span>
        <span className="flex-1 text-sm font-medium">{order.strategyName}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${statusColor(order.status)}`}
        >
          {order.status}
        </span>
      </div>

      {/* Row 2 — Price · TIF · Time */}
      <div className="mt-1.5 flex items-center gap-3 text-sm">
        <span
          className={`font-mono font-medium ${price.isCredit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {price.text}
        </span>
        <span className="opacity-50">·</span>
        <span className="opacity-60">{order.tif}</span>
        <span className="opacity-50">·</span>
        <span className="font-mono text-xs opacity-60">
          {mounted
            ? order.updatedAt.toLocaleString("en-US", {
                month: "numeric",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </span>
      </div>

      {/* Row 3 — Legs */}
      <div className="mt-1.5 flex flex-col gap-0.5">
        {order.legs.map((leg) => (
          <LegDescription key={leg.id} leg={leg} />
        ))}
      </div>

      {/* Order number */}
      <div className="mt-1 text-xs opacity-30">#{order.orderNumber}</div>
    </div>
  );
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 20);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function OrdersView() {
  const router = useRouter();
  const { ordersState, fetchOrdersRange, invalidateOrdersCache, setPrefilledOrder } = useApp();

  const [statusFilter, setStatusFilter] = useState("All");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [mounted, setMounted] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    order: Order;
    x: number;
    y: number;
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPosRef = useRef<{ x: number; y: number } | null>(null);

  const defaultRange = getDefaultDateRange();
  const displayDateStart = dateStart || (mounted ? defaultRange.start : "");
  const displayDateEnd = dateEnd || (mounted ? defaultRange.end : "");

  // Voice agent filter API — updated each render so setters always close over current state
  const voiceImplRef = useRef<{ setFilter: (f: VoiceOrdersFilter) => void }>(null!);
  voiceImplRef.current = {
    setFilter: ({ status, symbol, dateStart: ds, dateEnd: de }) => {
      if (status !== undefined) setStatusFilter(status || "All");
      if (symbol !== undefined) setSymbolFilter(symbol);
      if (ds !== undefined) setDateStart(ds);
      if (de !== undefined) setDateEnd(de);
    },
  };
  const voiceOrdersApi = useMemo<VoiceOrdersApi>(
    () => ({ setFilter: (f) => { voiceImplRef.current.setFilter(f); return { ok: true, message: "Filter applied." }; } }),
    [],
  );
  useRegisterVoiceOrders(voiceOrdersApi);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !dateStart && !dateEnd) {
      const { start, end } = getDefaultDateRange();
      setDateStart(start);
      setDateEnd(end);
    }
  }, [mounted, dateStart, dateEnd]);

  useEffect(() => {
    if (displayDateStart && displayDateEnd) {
      fetchOrdersRange(displayDateStart, displayDateEnd);
    }
  }, [displayDateStart, displayDateEnd, fetchOrdersRange]);

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeContextMenu();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

  const { orders, loading, error } = ordersState;

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "All" && order.status !== statusFilter) return false;
    const sym = symbolFilter.trim().toUpperCase();
    if (sym && !order.symbol.toUpperCase().includes(sym)) return false;
    if (dateStart) {
      const [y, m, d] = dateStart.split("-").map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (order.updatedAt < start) return false;
    }
    if (dateEnd) {
      const [y, m, d] = dateEnd.split("-").map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      if (order.updatedAt > end) return false;
    }
    return true;
  });

  // ── Context menu helpers ───────────────────────────────────────────────────

  function openContextMenu(order: Order, x: number, y: number) {
    setCancelError(null);
    setContextMenu({ order, x, y });
  }

  function closeContextMenu() {
    setContextMenu(null);
    setCancelError(null);
  }

  function handleContextMenu(e: React.MouseEvent, order: Order) {
    e.preventDefault();
    openContextMenu(order, e.clientX, e.clientY);
  }

  function handleTouchStart(e: React.TouchEvent, order: Order) {
    const touch = e.touches[0];
    longPressPosRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = setTimeout(() => {
      if (longPressPosRef.current) {
        openContextMenu(order, longPressPosRef.current.x, longPressPosRef.current.y);
      }
    }, 500);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!longPressPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - longPressPosRef.current.x;
    const dy = touch.clientY - longPressPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  // ── Order actions ──────────────────────────────────────────────────────────

  async function handleCancel(order: Order) {
    setCancellingId(order.id);
    try {
      await cancelOrder(order.id);
      invalidateOrdersCache();
      closeContextMenu();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancellingId(null);
    }
  }

  function handleSimilar(order: Order) {
    setPrefilledOrder({
      symbol: order.symbol,
      strategyName: order.strategyName,
      legs: order.legs,
      tif: order.tif as "Day" | "GTC",
      totalCost: order.totalCost,
    });
    router.push(`/${strategyToSlug(order.strategyName)}`);
    closeContextMenu();
  }

  // Opposite of an opening order closes the opened position: flip the side and
  // mark every leg "Close" (BTO→STC, STO→BTC). Closing orders have no opposite.
  function handleOpposite(order: Order) {
    setPrefilledOrder({
      symbol: order.symbol,
      strategyName: order.strategyName,
      legs: order.legs.map((leg) => ({
        ...leg,
        side: leg.side === "Long" ? ("Short" as const) : ("Long" as const),
        openClose: "Close" as const,
      })),
      tif: order.tif as "Day" | "GTC",
      totalCost: -order.totalCost,
    });
    router.push(`/${strategyToSlug(order.strategyName)}`);
    closeContextMenu();
  }

  function handleReplace(order: Order) {
    setPrefilledOrder({
      symbol: order.symbol,
      strategyName: order.strategyName,
      legs: order.legs,
      tif: order.tif as "Day" | "GTC",
      totalCost: order.totalCost,
      replaceOrderId: order.id,
    });
    router.push(`/${strategyToSlug(order.strategyName)}`);
    closeContextMenu();
  }

  // ── Context menu positioning ───────────────────────────────────────────────

  function menuStyle(x: number, y: number): React.CSSProperties {
    const menuW = 192;
    const menuH = 200;
    return {
      left: Math.min(x, window.innerWidth - menuW - 8),
      top: Math.min(y, window.innerHeight - menuH - 8),
    };
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white p-4 dark:bg-black sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">Orders</h1>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:mb-6">
          {/* Status pills */}
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-10 touch-manipulation rounded-full border-2 px-3 py-1.5 text-sm font-bold transition sm:px-4 ${
                  statusFilter !== status
                    ? "border-black bg-transparent hover:bg-black/10 dark:border-white dark:hover:bg-white/10"
                    : status === "All"
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : statusColor(status)
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search + date row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Symbol search */}
            <div className="flex items-center gap-1.5">
              <span className="text-black/50 dark:text-white/50">🔍</span>
              <input
                type="text"
                placeholder="Symbol"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-24 rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black sm:w-28"
              />
            </div>

            {/* Date range */}
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={displayDateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-36 rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black"
              />
              <span className="text-sm opacity-60">–</span>
              <input
                type="date"
                value={displayDateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-36 rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">Loading orders…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
            <p className="font-medium text-red-700 dark:text-red-400">
              {error.message}
            </p>
            <button
              type="button"
              onClick={() => fetchOrdersRange(displayDateStart, displayDateEnd)}
              className="mt-2 rounded border-2 border-red-600 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-600 hover:text-white"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">No orders found</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="rounded-xl border-2 border-black bg-white dark:border-white dark:bg-black sm:hidden">
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  mounted={mounted}
                  onContextMenu={(e) => handleContextMenu(e, order)}
                  onTouchStart={(e) => handleTouchStart(e, order)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black sm:block">
              <table className="w-full min-w-200">
                <thead>
                  <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
                    <th className="px-2 py-3 sm:px-4">Symbol</th>
                    <th className="px-2 py-3 sm:px-4">Strategy</th>
                    <th className="px-2 py-3 sm:px-4">Status</th>
                    <th className="px-2 py-3 sm:px-4">Price</th>
                    <th className="px-2 py-3 sm:px-4">TIF</th>
                    <th className="px-2 py-3 sm:px-4">Time</th>
                    <th className="px-2 py-3 sm:px-4">Order #</th>
                    <th className="px-2 py-3 sm:px-4">Description</th>
                    <th className="w-14 px-2 py-3 sm:w-20 sm:px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const price = formatPrice(order.totalCost);
                    return (
                      <tr
                        key={order.id}
                        className="select-none border-b border-black/20 dark:border-white/20"
                        onContextMenu={(e) => handleContextMenu(e, order)}
                        onTouchStart={(e) => handleTouchStart(e, order)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                      >
                        <td className="px-2 py-2 font-medium sm:px-4">
                          {order.symbol}
                        </td>
                        <td className="px-2 py-2 sm:px-4">
                          {order.strategyName}
                        </td>
                        <td className="px-2 py-2 sm:px-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${statusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-sm sm:px-4">
                          <span
                            className={
                              price.isCredit
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {price.text}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-sm sm:px-4">
                          {order.tif}
                        </td>
                        <td className="px-2 py-2 text-xs sm:px-4">
                          {mounted
                            ? order.updatedAt.toLocaleString("en-US", {
                                month: "numeric",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </td>
                        <td className="px-2 py-2 text-xs sm:px-4">
                          {order.orderNumber}
                        </td>
                        <td className="px-2 py-2 text-xs sm:px-4">
                          <div className="flex flex-col gap-0.5">
                            {order.legs.map((leg) => (
                              <LegDescription key={leg.id} leg={leg} />
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-2 sm:px-4" />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Context menu ──────────────────────────────────────────────────────── */}
      {contextMenu && (
        <>
          {/* Backdrop — pointerdown fires on new press only, not on the synthetic click after long press */}
          <div
            className="fixed inset-0 z-40"
            onPointerDown={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />

          {/* Menu */}
          <div
            className="fixed z-50 w-48 overflow-hidden rounded-xl border-2 border-black bg-white shadow-2xl dark:border-white dark:bg-black"
            style={menuStyle(contextMenu.x, contextMenu.y)}
          >
            {/* Header */}
            <div className="border-b border-black/10 px-3 py-2 dark:border-white/10">
              <p className="truncate text-xs font-bold">
                {contextMenu.order.symbol}
              </p>
              <p className="truncate text-xs opacity-50">
                {contextMenu.order.strategyName}
              </p>
            </div>

            {/* Actions */}
            <div className="py-1">
              {contextMenu.order.status === "Working" && (
                <button
                  type="button"
                  onClick={() => handleReplace(contextMenu.order)}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Replace
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSimilar(contextMenu.order)}
                className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
              >
                Similar
              </button>
              {/* A closing order has no opposite — you can't "re-open" via opposite */}
              {!contextMenu.order.legs.some((l) => l.openClose === "Close") && (
                <button
                  type="button"
                  onClick={() => handleOpposite(contextMenu.order)}
                  className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Opposite
                </button>
              )}
              {contextMenu.order.status === "Working" && (
                <>
                  <div className="mx-3 my-1 border-t border-black/10 dark:border-white/10" />
                  <button
                    type="button"
                    onClick={() => handleCancel(contextMenu.order)}
                    disabled={cancellingId === contextMenu.order.id}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    {cancellingId === contextMenu.order.id
                      ? "Cancelling…"
                      : "Cancel"}
                  </button>
                </>
              )}
            </div>

            {/* Cancel error */}
            {cancelError && (
              <div className="border-t border-red-200 px-3 py-2 dark:border-red-900">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {cancelError}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
