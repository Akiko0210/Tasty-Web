"use client";

import { useState, useRef, useEffect } from "react";
import type { Leg } from "@/lib/types";
import { availableStrikes } from "@/lib/constants";
import { TrashIcon } from "./Icons";

interface LegRowProps {
  leg: Leg;
  onUpdate: (updates: Partial<Leg>) => void;
  onRemove: () => void;
}

function StrikeDropdown({
  value,
  onChange,
}: {
  value: number;
  onChange: (strike: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentIdx = availableStrikes.indexOf(value);
  const showAbove = 6;
  const showBelow = 6;
  const startIdx = Math.max(0, currentIdx - showAbove);
  const endIdx = Math.min(availableStrikes.length, currentIdx + showBelow + 1);
  const visibleStrikes = availableStrikes.slice(startIdx, endIdx);
  const itemsAbove = currentIdx - startIdx;
  const itemHeight = 32;
  const topOffset = -(itemsAbove * itemHeight);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium text-left dark:border-white dark:bg-black dark:text-white"
      >
        {value}
      </button>
      {open && (
        <ul
          style={{ top: topOffset }}
          className="absolute left-0 z-50 w-20 rounded-lg border-2 border-blue-500 bg-white shadow-xl ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-black dark:ring-blue-400/20"
        >
          {visibleStrikes.map((strike) => (
            <li key={strike}>
              <button
                type="button"
                onClick={() => {
                  onChange(strike);
                  setOpen(false);
                }}
                className={`w-full px-2 py-1.5 text-sm text-left hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black ${
                  strike === value
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                {strike}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LegRow({ leg, onUpdate, onRemove }: LegRowProps) {
  return (
    <tr className="border-b border-black/30 dark:border-white/30">
      <td className="px-4 py-2">
        <StrikeDropdown
          value={leg.strike}
          onChange={(strike) => onUpdate({ strike })}
        />
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={() =>
            onUpdate({ type: leg.type === "Call" ? "Put" : "Call" })
          }
          className="rounded border-2 border-black px-2 py-1 text-xs font-bold hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
        >
          {leg.type}
        </button>
      </td>
      <td className="px-4 py-2">
        <input
          type="text"
          value={leg.expiration}
          onChange={(e) => onUpdate({ expiration: e.target.value })}
          className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
        />
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={() =>
            onUpdate({ side: leg.side === "Short" ? "Long" : "Short" })
          }
          className={`rounded border-2 px-2 py-1 text-xs font-bold ${leg.side === "Short" ? "border-red-600 bg-red-600 text-white dark:border-red-400 dark:bg-red-600 dark:text-white" : "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-600 dark:text-white"}`}
        >
          {leg.side}
        </button>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min={1}
          value={leg.size}
          onChange={(e) =>
            onUpdate({ size: Math.max(1, Number(e.target.value) || 1) })
          }
          className="w-14 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step={0.01}
          value={leg.price}
          onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })}
          className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
        />
      </td>
      <td className="px-4 py-2">
        <button
          type="button"
          onClick={onRemove}
          className="rounded border-2 border-red-600 p-1 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
          aria-label="Remove leg"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}
