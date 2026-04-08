"use client";

import { useState, useEffect } from "react";
import type { Order, Leg } from "@/lib/types";
import { useTastyworksOrders } from "@/hooks/useTastyworksOrders";

function formatLegDescription(leg: Leg): string {
  const qty = leg.side === "Long" ? leg.size : -leg.size;
  const d = leg.daysToExpiry ?? 0;
  const action = leg.side === "Short" ? "STO" : "BTO";
  return `${qty} ${leg.expiration} ${d}d ${leg.strike} ${leg.type[0]} ${action}`;
}

function formatPrice(order: Order): { text: string; isCredit: boolean } {
  const amount = order.totalCost / 100;
  const isCredit = order.totalCost <= 0;
  const display = isCredit
    ? `${Math.abs(amount).toFixed(2)}`
    : `-${amount.toFixed(2)}`;
  return {
    text: `LMT ${display} ${isCredit ? "cr" : "db"}`,
    isCredit,
  };
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
  const [statusFilter, setStatusFilter] = useState("All");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [mounted, setMounted] = useState(false);

  const defaultRange = getDefaultDateRange();
  const displayDateStart = dateStart || (mounted ? defaultRange.start : "");
  const displayDateEnd = dateEnd || (mounted ? defaultRange.end : "");

  const api = useTastyworksOrders({
    startDate: displayDateStart,
    endDate: displayDateEnd,
    enabled: Boolean(displayDateStart && displayDateEnd),
  });

  const orders = api.usedApi && !api.loading ? api.orders : [];

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

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "All" && order.status !== statusFilter) return false;
    const sym = symbolFilter.trim().toUpperCase();
    if (sym && !order.symbol.toUpperCase().includes(sym)) return false;
    if (dateStart && order.createdAt < new Date(dateStart)) return false;
    if (dateEnd) {
      const end = new Date(dateEnd);
      end.setHours(23, 59, 59, 999);
      if (order.createdAt > end) return false;
    }
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white p-4 dark:bg-black sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <h1 className="mb-4 text-xl font-bold sm:mb-6 sm:text-2xl">Orders</h1>

        <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTER_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`min-h-[44px] touch-manipulation rounded-full border-2 px-4 py-2 text-sm font-bold transition sm:px-5 ${
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

          <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <span className="hidden sm:inline">Symbol</span>
              <span className="sr-only">Symbol filter</span>
              <span className="text-black/60 dark:text-white/60">🔍</span>
              <input
                type="text"
                placeholder="SYM"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value)}
                className="w-24 rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black sm:w-28"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="hidden sm:inline">Date</span>
              <span className="sr-only">Date filter</span>
              <input
                type="date"
                value={displayDateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black"
              />
              <span className="opacity-70">–</span>
              <input
                type="date"
                value={displayDateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="rounded border-2 border-black bg-white px-2 py-1.5 text-sm dark:border-white dark:bg-black"
              />
              <button
                type="button"
                title="Pick date range"
                className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded border-2 border-black dark:border-white"
              >
                📅
              </button>
              <button
                type="button"
                title="Download"
                className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded border-2 border-black dark:border-white"
              >
                ⬇
              </button>
            </label>
            <button
              type="button"
              className="min-h-[44px] touch-manipulation rounded border-2 border-green-600 bg-green-600 px-4 py-2 text-sm font-bold text-white"
            >
              Live
            </button>
          </div>
        </div>

        {api.loading && api.usedApi ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">Loading orders…</p>
          </div>
        ) : api.error ? (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950/30">
            <p className="font-medium text-red-700 dark:text-red-400">
              {api.error.message}
            </p>
            <button
              type="button"
              onClick={() => api.refetch()}
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
          <div className="overflow-x-auto rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
            <table className="w-full min-w-[800px]">
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
                  const price = formatPrice(order);
                  // const price = order.totalCost;
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-black/20 dark:border-white/20"
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
                      <td className="px-2 py-2 text-sm sm:px-4">{order.tif}</td>
                      <td className="px-2 py-2 text-xs sm:px-4">
                        {mounted
                          ? order.createdAt.toLocaleString("en-US", {
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
                          {order.legs.map((leg) => {
                            const desc = formatLegDescription(leg);
                            const isSto = desc.endsWith("STO");
                            const base = desc.replace(/\s(STO|BTO)$/, "");
                            return (
                              <span key={leg.id}>
                                {base}{" "}
                                <span
                                  className={
                                    isSto
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-green-600 dark:text-green-400"
                                  }
                                >
                                  {isSto ? "STO" : "BTO"}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-2 py-2 sm:px-4" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
