"use client";

import { useState, useEffect } from "react";
import type { Order, OrderStatus } from "@/lib/types";

interface OrdersViewProps {
  orders: Order[];
  onCancel: (orderId: string) => void;
}

export function OrdersView({ orders, onCancel }: OrdersViewProps) {
  const [filter, setFilter] = useState<OrderStatus | "All">("All");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const statuses: (OrderStatus | "All")[] = [
    "All",
    "Live",
    "Filled",
    "Completed",
    "Expired",
    "In-Draft",
  ];

  const filteredOrders =
    filter === "All"
      ? orders
      : orders.filter((order) => order.status === filter);

  function getOrderCount(status: OrderStatus | "All"): number {
    if (status === "All") return orders.length;
    return orders.filter((order) => order.status === status).length;
  }

  function getStatusColor(status: OrderStatus): string {
    switch (status) {
      case "Live":
        return "border-yellow-600 bg-yellow-600 text-white dark:border-yellow-400 dark:bg-yellow-600 dark:text-white";
      case "Filled":
        return "border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-600 dark:text-white";
      case "Completed":
        return "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-600 dark:text-white";
      case "Expired":
        return "border-gray-600 bg-gray-600 text-white dark:border-gray-400 dark:bg-gray-600 dark:text-white";
      case "In-Draft":
        return "border-purple-600 bg-purple-600 text-white dark:border-purple-400 dark:bg-purple-600 dark:text-white";
      default:
        return "border-gray-600 bg-gray-600 text-white dark:border-gray-400 dark:bg-gray-600 dark:text-white";
    }
  }

  function isConcluded(status: OrderStatus): boolean {
    return (
      status === "Filled" || status === "Completed" || status === "Expired"
    );
  }

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
                    <th className="px-4 py-3">Total Cost</th>
                    <th className="px-4 py-3">Status</th>
                    {orders.some((o) => isConcluded(o.status)) && (
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
                        {order.legs.map((leg, i) => (
                          <div key={i} className="text-xs">
                            {leg.side} {leg.size}x {leg.type} {leg.strike} @{" "}
                            {leg.price}
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-2 font-bold">
                        ${order.totalCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded border-2 px-2 py-1 text-xs font-bold ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      {orders.some((o) => isConcluded(o.status)) && (
                        <td className="px-4 py-2">
                          {/* {order.profitLoss} */}
                          {isConcluded(order.status) &&
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
                        {order.status === "Live" && (
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
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
