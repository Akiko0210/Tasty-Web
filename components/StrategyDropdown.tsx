"use client";

import type { StrategyConfig } from "@/lib/types";

interface StrategyDropdownProps {
  strategies: StrategyConfig[];
  selected: number | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (idx: number) => void;
}

export function StrategyDropdown({
  strategies,
  selected,
  isOpen,
  onToggle,
  onSelect,
}: StrategyDropdownProps) {
  const strategyName = selected !== null ? strategies[selected].name : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded border-2 border-black px-3 py-1.5 font-bold hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
      >
        <span>{strategyName}</span>
        <span className="opacity-70">▾</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border-2 border-black bg-white shadow-[0_8px_32px_rgba(0,0,0,0.22)] dark:border-white dark:bg-neutral-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            {strategies.map((cfg, idx) => (
              <button
                key={cfg.name}
                type="button"
                onClick={() => {
                  onSelect(idx);
                  onToggle();
                }}
                className={`w-full px-3 py-2 text-left text-sm font-medium ${
                  selected === idx
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                {cfg.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
