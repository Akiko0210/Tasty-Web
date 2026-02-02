"use client";

import { useApp } from "@/contexts/AppContext";
import { StrategyPanel } from "@/components/StrategyPanel";

export default function Home() {
  const { selected } = useApp();

  if (selected === null) return null;

  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-black">
      <StrategyPanel />
    </div>
  );
}
