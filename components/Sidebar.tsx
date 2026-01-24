"use client";

import type { StrategyConfig } from "@/lib/types";
import { StrategySelector } from "./StrategySelector";
import { useApp } from "@/contexts/AppContext";
import { usePathname, useRouter } from "next/navigation";

interface SidebarProps {
  strategies: StrategyConfig[];
  selected: number | null;
  onSelectStrategy: (idx: number) => void;
}

export function Sidebar({ strategies, selected, onSelectStrategy }: SidebarProps) {
  const { balance } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === "/orders" ? "orders" : "strategy";

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r-2 border-black bg-white dark:border-white dark:bg-black">
      <StrategySelector
      strategies={strategies}
      selected={selected}
      balance={balance}
      onSelect={(idx) => {
        onSelectStrategy(idx);
        router.push("/");
      }}
    />
    <div className="border-t-2 border-black p-3 dark:border-white">
      <button
        type="button"
        onClick={() => router.push("/")}
        className={`mb-2 w-full rounded-lg border-2 border-black px-3 py-2 text-center text-sm font-bold transition ${
          active === "strategy"
            ? "bg-black text-white dark:bg-white dark:text-black"
            : "hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
        }`}
      >
        Strategies
      </button>
      <button
        type="button"
        onClick={() => router.push("/orders")}
        className={`w-full rounded-lg border-2 border-black px-3 py-2 text-center text-sm font-bold transition ${
          active === "orders"
            ? "bg-black text-white dark:bg-white dark:text-black"
            : "hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black"
        }`}
      >
        Orders
      </button>
    </div>
  </aside>
  );
}
