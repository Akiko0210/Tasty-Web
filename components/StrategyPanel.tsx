"use client";

import type { Leg } from "@/lib/types";
import { StrategyDropdown } from "./StrategyDropdown";
import { LegRow } from "./LegRow";
import type { StrategyConfig } from "@/lib/types";

interface StrategyPanelProps {
  strategies: StrategyConfig[];
  selected: number | null;
  legs: Leg[];
  currentPrice: number;
  totalCost: number;
  dropdownOpen: boolean;
  onDropdownToggle: () => void;
  onSelectStrategy: (idx: number) => void;
  onUpdateLeg: (legId: string, updates: Partial<Leg>) => void;
  onRemoveLeg: (legId: string) => void;
  onAddPosition: () => void;
  onAddOrder: () => void;
}

export function StrategyPanel({
  strategies,
  selected,
  legs,
  currentPrice,
  totalCost,
  dropdownOpen,
  onDropdownToggle,
  onSelectStrategy,
  onUpdateLeg,
  onRemoveLeg,
  onAddPosition,
  onAddOrder,
}: StrategyPanelProps) {
  if (selected === null) return null;

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-4xl rounded-xl border-2 border-black bg-white shadow-lg dark:border-white dark:bg-black">
        <header className="flex items-center justify-between border-b-2 border-black px-4 py-3 dark:border-white">
          <div className="flex items-center gap-4">
            <StrategyDropdown
              strategies={strategies}
              selected={selected}
              isOpen={dropdownOpen}
              onToggle={onDropdownToggle}
              onSelect={onSelectStrategy}
            />
            <div className="flex items-center gap-2 border-l-2 border-black pl-4 dark:border-white">
              <span className="text-xs font-medium opacity-80">SPX Price:</span>
              <span className="text-sm font-bold">
                {currentPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </header>

        <div className="overflow-x-auto">
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
                  onUpdate={(updates) => onUpdateLeg(leg.id, updates)}
                  onRemove={() => onRemoveLeg(leg.id)}
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
                onClick={onAddPosition}
                className="rounded-lg border-2 border-dashed border-black px-4 py-2 text-sm font-bold transition hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
              >
                + New position
              </button>
              <button
                type="button"
                onClick={onAddOrder}
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
