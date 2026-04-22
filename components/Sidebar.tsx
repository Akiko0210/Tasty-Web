"use client";

import { useState } from "react";
import type { StrategyConfig } from "@/lib/types";
import { StrategySelector } from "./StrategySelector";
import { useApp } from "@/contexts/AppContext";
import { usePathname, useRouter } from "next/navigation";

interface SidebarProps {
  strategies: StrategyConfig[];
}

export function Sidebar({ strategies }: SidebarProps) {
  const { balance, selected, setSelected } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === "/orders" ? "orders" : "strategy";
  const [mobileOpen, setMobileOpen] = useState(false);

  function navigate(path: string) {
    router.push(path);
    setMobileOpen(false);
  }

  function selectStrategy(idx: number) {
    setSelected(idx);
    router.push("/");
    setMobileOpen(false);
  }

  const navButtonClass = (isActive: boolean) =>
    `w-full rounded-lg border-2 border-black px-3 py-2 text-center text-sm font-bold transition
     ${isActive
       ? "bg-black text-white dark:bg-white dark:text-black"
       : "hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
     }`;

  return (
    <>
      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b-2 border-black bg-white px-4 lg:hidden dark:border-white dark:bg-black">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded border-2 border-black text-lg font-bold dark:border-white"
          aria-label="Open menu"
        >
          ☰
        </button>
        <span className="text-sm font-bold uppercase tracking-widest">TastyTrade</span>
        <span className="text-sm font-bold tabular-nums">
          ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </header>

      {/* ── Drawer backdrop (mobile) ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar (drawer on mobile, fixed on desktop) ─────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r-2 border-black bg-white transition-transform duration-200 dark:border-white dark:bg-black
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Close button (mobile only) */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded border-2 border-black text-sm font-bold lg:hidden dark:border-white"
          aria-label="Close menu"
        >
          ✕
        </button>

        <StrategySelector
          strategies={strategies}
          selected={selected}
          balance={balance}
          onSelect={selectStrategy}
        />

        <div className="border-t-2 border-black p-3 dark:border-white">
          <button
            type="button"
            onClick={() => navigate("/")}
            className={`mb-2 ${navButtonClass(active === "strategy")}`}
          >
            Strategies
          </button>
          <button
            type="button"
            onClick={() => { setSelected(null); navigate("/orders"); }}
            className={navButtonClass(active === "orders")}
          >
            Activities
          </button>
        </div>
      </aside>
    </>
  );
}
