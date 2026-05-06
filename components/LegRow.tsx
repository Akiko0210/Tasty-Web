"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import type { Leg } from "@/lib/types";
import { resolveStrikeOnExpChange } from "@/lib/utils";
import { TrashIcon } from "./Icons";

function formatExpiration(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface LegRowProps {
  leg: Leg;
  onUpdate: (updates: Partial<Leg>) => void;
  onRemove: () => void;
  bid?: number;
  ask?: number;
  expirations?: string[];
  strikesByExpiration?: Record<string, number[]>;
  showPriceDetails?: boolean;
}

function useFixedDropdown(open: boolean) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const capture = useCallback(() => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left, width: r.width });
    }
  }, []);

  // Close on scroll/resize so the list doesn't drift
  useEffect(() => {
    if (!open) return;
    const close = () => setPos((p) => ({ ...p })); // triggers re-read but callers handle via open state
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return { buttonRef, pos, capture };
}

function StrikeDropdown({
  value,
  onChange,
  strikes = [],
}: {
  value: number;
  onChange: (strike: number) => void;
  strikes?: number[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { buttonRef, pos, capture } = useFixedDropdown(open);

  const currentIdx = strikes.indexOf(value);
  const itemHeight = 32;
  const visibleCount = 9;
  const centerIdx = Math.floor(visibleCount / 2);
  const maxHeight = visibleCount * itemHeight;
  const safeIdx = Math.max(0, currentIdx);
  const maxScrollTop = Math.max(0, strikes.length * itemHeight - maxHeight);
  const scrollTop = Math.max(0, Math.min(maxScrollTop, (safeIdx - centerIdx) * itemHeight));
  const dropdownTop = pos.top - (safeIdx * itemHeight - scrollTop);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = scrollTop;
    }
  }, [open, scrollTop]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { capture(); setOpen((p) => !p); }}
        className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium text-left dark:border-white dark:bg-black dark:text-white"
      >
        {value}
      </button>
      {open && (
        <ul
          ref={listRef}
          style={{ position: "fixed", top: dropdownTop, left: pos.left, width: pos.width, maxHeight, zIndex: 9999 }}
          className="overflow-y-auto rounded-lg border-2 border-blue-500 bg-white shadow-xl ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-black dark:ring-blue-400/20"
        >
          {strikes.map((strike) => (
            <li key={strike}>
              <button
                type="button"
                onClick={() => { onChange(strike); setOpen(false); }}
                className={`w-full px-2 py-1.5 text-sm text-left ${
                  strike === value
                    ? "bg-blue-500 text-white dark:bg-blue-400 dark:text-black"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700"
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

function ExpirationDropdown({
  value,
  onChange,
  expirations = [],
}: {
  value: string;
  onChange: (expiration: string) => void;
  expirations?: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { buttonRef, pos, capture } = useFixedDropdown(open);

  const currentIdx = expirations.indexOf(value);
  const itemHeight = 32;
  const visibleCount = 9;
  const centerIdx = Math.floor(visibleCount / 2);
  const maxHeight = visibleCount * itemHeight;
  const safeIdx = Math.max(0, currentIdx);
  const maxScrollTop = Math.max(0, expirations.length * itemHeight - maxHeight);
  const scrollTop = Math.max(0, Math.min(maxScrollTop, (safeIdx - centerIdx) * itemHeight));
  const dropdownTop = pos.top - (safeIdx * itemHeight - scrollTop);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = scrollTop;
    }
  }, [open, scrollTop]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { capture(); setOpen((p) => !p); }}
        className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium text-left dark:border-white dark:bg-black dark:text-white"
      >
        {value ? formatExpiration(value) : "—"}
      </button>
      {open && (
        <ul
          ref={listRef}
          style={{ position: "fixed", top: dropdownTop, left: pos.left, width: pos.width, maxHeight, zIndex: 9999 }}
          className="overflow-y-auto rounded-lg border-2 border-blue-500 bg-white shadow-xl ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-black dark:ring-blue-400/20"
        >
          {expirations.map((exp) => (
            <li key={exp}>
              <button
                type="button"
                onClick={() => { onChange(exp); setOpen(false); }}
                className={`w-full px-2 py-1.5 text-sm text-left ${
                  exp === value
                    ? "bg-blue-500 text-white dark:bg-blue-400 dark:text-black"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {formatExpiration(exp)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useStrikesForExp(
  leg: LegRowProps["leg"],
  strikesByExpiration: LegRowProps["strikesByExpiration"],
) {
  return (leg.expiration ? strikesByExpiration?.[leg.expiration] : undefined) ?? [];
}

// ── Side / type button styles ─────────────────────────────────────────────────

const sideClass = (side: string) =>
  `rounded border-2 px-2 py-1 text-xs font-bold ${
    side === "Short"
      ? "border-red-600 bg-red-600 text-white dark:border-red-400 dark:bg-red-600"
      : "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-600"
  }`;

const typeClass =
  "rounded border-2 border-black px-2 py-1 text-xs font-bold hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black";

// ── Desktop table row ─────────────────────────────────────────────────────────

export function LegRow({
  leg,
  onUpdate,
  onRemove,
  bid,
  ask,
  expirations,
  strikesByExpiration,
  showPriceDetails = false,
}: LegRowProps) {
  const strikesForExp = useStrikesForExp(leg, strikesByExpiration);

  return (
    <tr className="border-b border-black/30 dark:border-white/30">
      <td className="px-4 py-2">
        <StrikeDropdown
          value={leg.strike}
          onChange={(strike) => onUpdate({ strike })}
          strikes={strikesForExp}
        />
      </td>
      <td className="px-4 py-2">
        <button type="button" onClick={() => onUpdate({ type: leg.type === "Call" ? "Put" : "Call" })} className={typeClass}>
          {leg.type}
        </button>
      </td>
      <td className="px-4 py-2">
        <ExpirationDropdown
          value={leg.expiration}
          onChange={(exp) => onUpdate({ expiration: exp, strike: resolveStrikeOnExpChange(exp, leg.strike, strikesByExpiration) })}
          expirations={expirations}
        />
      </td>
      <td className="px-4 py-2">
        <button type="button" onClick={() => onUpdate({ side: leg.side === "Short" ? "Long" : "Short" })} className={sideClass(leg.side)}>
          {leg.side}
        </button>
      </td>
      <td className="px-4 py-2">
        <input
          type="number" min={1} value={leg.size}
          onChange={(e) => onUpdate({ size: Math.max(1, Number(e.target.value) || 1) })}
          className="w-14 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
        />
      </td>
      {showPriceDetails && (
        <>
          <td className="px-4 py-2">
            <input
              type="number" step={0.01} value={leg.price}
              onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })}
              className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
            />
          </td>
          <td className="px-4 py-2 font-mono text-sm">{bid !== undefined ? bid.toFixed(2) : "—"}</td>
          <td className="px-4 py-2 font-mono text-sm">{ask !== undefined ? ask.toFixed(2) : "—"}</td>
        </>
      )}
      <td className="px-4 py-2">
        <button type="button" onClick={onRemove} className="rounded border-2 border-red-600 p-1 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white" aria-label="Remove leg">
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}

// ── Mobile card ───────────────────────────────────────────────────────────────

export function LegCard({
  leg,
  onUpdate,
  onRemove,
  bid,
  ask,
  expirations,
  strikesByExpiration,
  showPriceDetails = false,
}: LegRowProps) {
  const strikesForExp = useStrikesForExp(leg, strikesByExpiration);

  if (!showPriceDetails) {
    // ── Collapsed: single row ──────────────────────────────────────────────
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2">
        <button
          type="button"
          onClick={() => onUpdate({ side: leg.side === "Short" ? "Long" : "Short" })}
          className={sideClass(leg.side)}
        >
          {leg.side}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ type: leg.type === "Call" ? "Put" : "Call" })}
          className={typeClass}
        >
          {leg.type}
        </button>
        <StrikeDropdown
          value={leg.strike}
          onChange={(strike) => onUpdate({ strike })}
          strikes={strikesForExp}
        />
        <ExpirationDropdown
          value={leg.expiration}
          onChange={(exp) => onUpdate({ expiration: exp, strike: resolveStrikeOnExpChange(exp, leg.strike, strikesByExpiration) })}
          expirations={expirations}
        />
        <input
          type="number" min={1} value={leg.size}
          onChange={(e) => onUpdate({ size: Math.max(1, Number(e.target.value) || 1) })}
          className="w-12 shrink-0 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
        />
        <button
          type="button" onClick={onRemove}
          className="ml-auto shrink-0 rounded border-2 border-red-600 p-1.5 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
          aria-label="Remove leg"
        >
          <TrashIcon />
        </button>
      </div>
    );
  }

  // ── Expanded: multi-row with price details ─────────────────────────────
  return (
    <div className="space-y-3 px-4 py-3">
      {/* Row 1 — Side · Type · Size · Delete */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onUpdate({ side: leg.side === "Short" ? "Long" : "Short" })}
          className={`min-h-[36px] min-w-[56px] ${sideClass(leg.side)}`}
        >
          {leg.side}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ type: leg.type === "Call" ? "Put" : "Call" })}
          className={`min-h-[36px] min-w-[44px] ${typeClass}`}
        >
          {leg.type}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold opacity-40">×</span>
            <input
              type="number" min={1} value={leg.size}
              onChange={(e) => onUpdate({ size: Math.max(1, Number(e.target.value) || 1) })}
              className="w-14 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
            />
          </div>
          <button
            type="button" onClick={onRemove}
            className="rounded border-2 border-red-600 p-1.5 text-red-600 hover:bg-red-600 hover:text-white dark:border-red-400 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
            aria-label="Remove leg"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Row 2 — Strike · Expiry */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">Strike</span>
          <StrikeDropdown
            value={leg.strike}
            onChange={(strike) => onUpdate({ strike })}
            strikes={strikesForExp}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">Expiry</span>
          <ExpirationDropdown
            value={leg.expiration}
            onChange={(exp) => onUpdate({ expiration: exp, strike: resolveStrikeOnExpChange(exp, leg.strike, strikesByExpiration) })}
            expirations={expirations}
          />
        </div>
      </div>

      {/* Row 3 — Price · Bid · Ask */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">Price</span>
          <input
            type="number" step={0.01} value={leg.price}
            onChange={(e) => onUpdate({ price: Number(e.target.value) || 0 })}
            className="w-20 rounded border-2 border-black bg-white px-2 py-1.5 text-sm font-medium dark:border-white dark:bg-black dark:text-white"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">Bid</span>
          <span className="py-1.5 font-mono text-sm">{bid !== undefined ? bid.toFixed(2) : "—"}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider opacity-50">Ask</span>
          <span className="py-1.5 font-mono text-sm">{ask !== undefined ? ask.toFixed(2) : "—"}</span>
        </div>
      </div>
    </div>
  );
}
