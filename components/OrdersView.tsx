"use client";

import { useState, useEffect } from "react";
import type { Order, LegStatus } from "@/lib/types";

interface OrdersViewProps {
  orders: Order[];
  onCancel: (orderId: string) => void;
}

function orderHasLegWithStatus(order: Order, status: LegStatus): boolean {
  return order.legs.some((l) => l.status === status);
}

function orderIsFullyConcluded(order: Order): boolean {
  return order.legs.every((l) =>
    ["Filled", "Expired", "Canceled", "Rejected"].includes(l.status),
  );
}

function orderHasCancelableLeg(order: Order): boolean {
  return order.legs.some(
    (l) => l.status === "Working" || l.status === "Partially filled",
  );
}

export function OrdersView({ orders, onCancel }: OrdersViewProps) {
  const [filter, setFilter] = useState<LegStatus | "All">("All");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const statuses: (LegStatus | "All")[] = [
    "All",
    "Working",
    "Partially filled",
    "Filled",
    "Canceled",
    "Rejected",
    "Expired",
  ];

  const filteredOrders =
    filter === "All"
      ? orders
      : orders.filter((o) => orderHasLegWithStatus(o, filter));

  const totalCost = filteredOrders.reduce((sum, o) => sum + o.totalCost, 0);
  const totalProfitLoss = filteredOrders.reduce(
    (sum, o) => sum + (o.profitLoss ?? 0),
    0,
  );

  function getOrderCount(status: LegStatus | "All"): number {
    if (status === "All") return orders.length;
    return orders.filter((o) => orderHasLegWithStatus(o, status)).length;
  }

  function getStatusColor(status: LegStatus): string {
    const base = "bg-black text-white dark:bg-black dark:text-white";
    switch (status) {
      case "Working":
        return `${base} border-yellow-600 dark:border-yellow-400`;
      case "Partially filled":
        return `${base} border-blue-600 dark:border-blue-400`;
      case "Filled":
        return `${base} border-green-600 dark:border-green-400`;
      case "Canceled":
        return `${base} border-gray-600 dark:border-gray-400`;
      case "Rejected":
        return `${base} border-red-600 dark:border-red-400`;
      case "Expired":
        return `${base} border-gray-500 dark:border-gray-500`;
      default:
        return `${base} border-gray-600 dark:border-gray-400`;
    }
  }

  const showProfitLoss = orders.some(orderIsFullyConcluded);

  return (
    <div className="flex flex-1 flex-col overflow-auto bg-white p-6 dark:bg-black">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="mb-6 text-2xl font-bold">Orders</h1>

        <div className="mb-6 flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded border-2 px-4 py-2 text-sm font-bold transition ${
                filter === status
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
              }`}
            >
              {status} {mounted && `(${getOrderCount(status)})`}
            </button>
          ))}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="rounded-xl border-2 border-black bg-white p-12 text-center dark:border-white dark:bg-black">
            <p className="text-lg font-medium opacity-70">No orders found</p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Legs</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total Cost</th>
                    {showProfitLoss && (
                      <th className="px-4 py-3">Profit/Loss</th>
                    )}
                    <th className="px-4 py-3">Created</th>
                    <th className="w-20 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-black/30 dark:border-white/30"
                    >
                      <td className="px-4 py-2 font-medium">
                        {order.strategyName}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {order.legs.map((leg) => (
                          <div key={leg.id} className="text-xs">
                            {leg.side === "Long" ? "+" : "-"}
                            {leg.size} {leg.type} {leg.strike} @ {leg.price}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          {order.legs.map((leg) => (
                            <span
                              key={leg.id}
                              className={`inline-block w-fit rounded border-2 px-2 py-0.5 text-xs font-bold ${getStatusColor(leg.status)}`}
                            >
                              {leg.status}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2 font-bold">
                        ${order.totalCost.toFixed(2)}
                      </td>
                      {showProfitLoss && (
                        <td className="px-4 py-2">
                          {orderIsFullyConcluded(order) &&
                          order.profitLoss !== undefined ? (
                            <span
                              className={`font-bold ${
                                order.profitLoss >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {order.profitLoss >= 0 ? "+" : ""}$
                              {order.profitLoss.toFixed(2)}
                            </span>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2 text-xs">
                        {mounted
                          ? order.createdAt.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </td>
                      <td className="px-4 py-2">
                        {orderHasCancelableLeg(order) && (
                          <button
                            type="button"
                            onClick={() => onCancel(order.id)}
                            className="rounded border-2 border-red-600 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black bg-gray-100 font-bold dark:border-white dark:bg-gray-900">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3">${totalCost.toFixed(2)}</td>
                    {showProfitLoss && (
                      <td className="px-4 py-3">
                        <span
                          className={
                            totalProfitLoss >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {totalProfitLoss >= 0 ? "+" : ""}$
                          {totalProfitLoss.toFixed(2)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
