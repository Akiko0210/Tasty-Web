"use client";

import { useState, useEffect } from "react";
import type { Leg, Order, OptionType, Side } from "@/lib/types";
import { strategyConfigs } from "@/lib/constants";
import { toLegs, calculateTotalCost } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { StrategyDropdown } from "./StrategyDropdown";
import { LegRow } from "./LegRow";

export function StrategyPanel() {
  const { balance, setBalance, setOrders, selected, setSelected } = useApp();
  const [legsByStrategy, setLegsByStrategy] = useState<Record<number, Leg[]>>(
    {},
  );
  const [currentPrice] = useState<number>(689);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const legs = selected !== null ? (legsByStrategy[selected] ?? []) : [];
  const totalCost = calculateTotalCost(legs);

  useEffect(() => {
    if (selected !== null) {
      setLegsByStrategy((prev) => {
        if (prev[selected]) return prev;
        const newLegs = toLegs(strategyConfigs[selected].defaultLegs);
        return { ...prev, [selected]: newLegs };
      });
    }
  }, [selected]);

  function updateLeg(legId: string, updates: Partial<Leg>) {
    if (selected === null) return;
    setLegsByStrategy((prev) => {
      const list = prev[selected] ?? [];
      return {
        ...prev,
        [selected]: list.map((l) =>
          l.id === legId ? { ...l, ...updates } : l,
        ),
      };
    });
  }

  function removeLeg(legId: string) {
    if (selected === null) return;
    setLegsByStrategy((prev) => {
      const list = (prev[selected] ?? []).filter((l) => l.id !== legId);
      return { ...prev, [selected]: list };
    });
  }

  function addPosition() {
    if (selected === null) return;
    const list = legsByStrategy[selected] ?? [];
    const last = list[list.length - 1];
    const base = last
      ? {
          ...last,
          strike: last.strike + 2,
          price: Math.max(0.5, last.price - 0.5),
        }
      : {
          strike: 689,
          type: "Call" as OptionType,
          expiration: "Feb 6",
          side: "Long" as Side,
          size: 1,
          price: 7.0,
        };
    const newLeg: Leg = {
      ...base,
      id: `leg-${Math.random().toString(36).substring(2, 9)}-${list.length}`,
      visible: true,
      status: "Working",
    };
    setLegsByStrategy((prev) => ({
      ...prev,
      [selected]: [...(prev[selected] ?? []), newLeg],
    }));
  }

  function addOrder() {
    if (selected === null || legs.length === 0) return;
    if (balance + totalCost < 0) {
      alert("Insufficient balance");
      return;
    }
    const newOrder: Order = {
      id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
      strategyName: strategyConfigs[selected].name,
      legs: legs.map((l) => ({ ...l })),
      createdAt: new Date(),
      totalCost,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setBalance((prev: number) => prev + totalCost);
  }

  if (selected === null) return null;

  return (
    <div className="p-6">
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
            <div className="flex items-center gap-2 border-l-2 border-black pl-4 dark:border-white">
              <span className="text-xs font-medium opacity-80">SPX Price:</span>
              <span className="text-sm font-bold">
                {currentPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </header>

        <div className="overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-wider dark:border-white">
                <th className="px-4 py-3">Strike</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3">S/L</th>
                <th className="px-4 py-3">
                  <span className="inline-flex items-center gap-1">
                    Size
                    <span
                      className="cursor-help opacity-70"
                      title="Number of contracts"
                    >
                      ⓘ
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3">Price</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {legs.map((leg) => (
                <LegRow
                  key={leg.id}
                  leg={leg}
                  onUpdate={(updates) => updateLeg(leg.id, updates)}
                  onRemove={() => removeLeg(leg.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <footer className="border-t-2 border-black px-4 py-3 dark:border-white">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addPosition}
                className="rounded-lg border-2 border-dashed border-black px-4 py-2 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
              >
                + New position
              </button>
              <button
                type="button"
                onClick={addOrder}
                className="rounded-lg border-2 border-black bg-black px-6 py-2 text-sm font-bold text-white transition hover:bg-black/80 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
              >
                Add Order
              </button>
            </div>
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
  );
}
