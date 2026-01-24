"use client";

import { strategyConfigs } from "@/lib/constants";
import { Sidebar } from "./Sidebar";
import { useApp } from "@/contexts/AppContext";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { selected, setSelected } = useApp();

  return (
    <div className="flex min-h-screen bg-white font-sans text-black dark:bg-black dark:text-white">
      <Sidebar
        strategies={strategyConfigs}
        selected={selected}
        onSelectStrategy={setSelected}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
