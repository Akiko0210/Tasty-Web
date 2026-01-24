"use client";

import { useState, useEffect } from "react";
import type { Order } from "@/lib/types";

interface OrderTableProps {
  orders: Order[];
  onCancel: (orderId: string) => void;
}

export function OrderTable({ orders, onCancel }: OrderTableProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const liveOrders = orders.filter((o) => o.status === "Live");
  if (liveOrders.length === 0) return null;

  return (
    <div className="mx-auto mt-6 w-full max-w-4xl rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
      <header className="border-b-2 border-black px-4 py-3 dark:border-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Live Orders</h2>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
              <th className="px-4 py-3">Strategy</th>
              <th className="px-4 py-3">Legs</th>
              <th className="px-4 py-3">Total Cost</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
              <th className="w-20 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {liveOrders.map((order) => (
              <tr key={order.id} className="border-b border-black/30 dark:border-white/30">
                <td className="px-4 py-2 font-medium">{order.strategyName}</td>
                <td className="px-4 py-2 text-sm">
                  {order.legs.map((leg, i) => (
                    <div key={i} className="text-xs">
                      {leg.side} {leg.size}x {leg.type} {leg.strike} @ {leg.price}
                    </div>
                  ))}
                </td>
                <td className="px-4 py-2 font-bold">${order.totalCost.toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded border-2 px-2 py-1 text-xs font-bold ${
                      order.status === "Live"
                        ? "border-yellow-600 bg-yellow-600 text-white dark:border-yellow-400 dark:bg-yellow-600 dark:text-white"
                        : order.status === "Filled"
                          ? "border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-600 dark:text-white"
                          : order.status === "Completed"
                            ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-600 dark:text-white"
                            : order.status === "Expired"
                              ? "border-gray-600 bg-gray-600 text-white dark:border-gray-400 dark:bg-gray-600 dark:text-white"
                              : "border-purple-600 bg-purple-600 text-white dark:border-purple-400 dark:bg-purple-600 dark:text-white"
                    }`}
                  >
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {mounted
                    ? order.createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
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
  );
}
