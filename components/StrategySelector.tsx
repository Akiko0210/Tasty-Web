"use client";

import { useState, useEffect } from "react";
import type { StrategyConfig } from "@/lib/types";

interface StrategySelectorProps {
  strategies: StrategyConfig[];
  selected: number | null;
  balance: number;
  onSelect: (idx: number) => void;
}

export function StrategySelector({
  strategies,
  selected,
  balance,
  onSelect,
}: StrategySelectorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div className="border-b-2 border-black p-4 dark:border-white">
        <div className="mb-2 text-xs font-bold uppercase opacity-70">
          Balance
        </div>
        <div className="text-2xl font-bold">
          {mounted
            ? `$${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "$0.00"}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-2 text-xs font-bold uppercase opacity-70">
          Strategies
        </div>
        {strategies.map((cfg, ind) => (
          <div
            key={cfg.name}
            onClick={() => onSelect(ind)}
            className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium ${selected === ind ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
          >
            {cfg.name}
          </div>
        ))}
      </div>
    </>
  );
}
