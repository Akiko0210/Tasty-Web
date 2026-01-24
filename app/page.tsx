"use client";

import { useEffect, useState } from "react";
import { strategyConfigs } from "@/lib/constants";
import { toLegs, calculateTotalCost } from "@/lib/utils";
import type { Leg, Order, OptionType, Side } from "@/lib/types";
import { useApp } from "@/contexts/AppContext";
import { StrategyPanel } from "@/components/StrategyPanel";

export default function Home() {
  const { balance, setBalance, orders, setOrders, selected, setSelected } = useApp();
  const [legsByStrategy, setLegsByStrategy] = useState<Record<number, Leg[]>>({});
  const [currentPrice] = useState<number>(689);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const legs = selected !== null ? legsByStrategy[selected] ?? [] : [];

  useEffect(() => {
    if (selected !== null) {
      setLegsByStrategy((prev) => {
        if (prev[selected]) return prev;
        const newLegs = toLegs(strategyConfigs[selected].defaultLegs);
        return { ...prev, [selected]: newLegs };
      });
    }
  }, [selected]);

  function updateLeg(strategyIdx: number, legId: string, updates: Partial<Leg>) {
    setLegsByStrategy((prev) => {
      const list = prev[strategyIdx] ?? [];
      return {
        ...prev,
        [strategyIdx]: list.map((l) => (l.id === legId ? { ...l, ...updates } : l)),
      };
    });
  }

  function removeLeg(strategyIdx: number, legId: string) {
    setLegsByStrategy((prev) => {
      const list = (prev[strategyIdx] ?? []).filter((l) => l.id !== legId);
      return { ...prev, [strategyIdx]: list };
    });
  }

  function addPosition(strategyIdx: number) {
    const list = legsByStrategy[strategyIdx] ?? [];
    const last = list[list.length - 1];
    const base = last
      ? { ...last, strike: last.strike + 2, price: Math.max(0.5, last.price - 0.5) }
      : { strike: 689, type: "Call" as OptionType, expiration: "Feb 6", side: "Long" as Side, size: 1, price: 7.0 };
    const newLeg: Leg = {
      ...base,
      id: `leg-${Math.random().toString(36).substring(2, 9)}-${list.length}`,
      visible: true,
    };
    setLegsByStrategy((prev) => ({
      ...prev,
      [strategyIdx]: [...(prev[strategyIdx] ?? []), newLeg],
    }));
  }

  function addOrder() {
    if (selected === null || legs.length === 0) return;
    const totalCost = calculateTotalCost(legs);
    if (balance + totalCost < 0) {
      alert("Insufficient balance");
      return;
    }
    const newOrder: Order = {
      id: `order-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`,
      strategyName: strategyConfigs[selected].name,
      legs: legs.map((l) => ({ ...l })),
      status: "Live",
      createdAt: new Date(),
      totalCost,
    };
    setOrders((prev) => [newOrder, ...prev]);
    setBalance((prev: number) => prev + totalCost);
  }

  return (
    <>
      {selected !== null && (
        <div className="flex flex-1 flex-col overflow-auto bg-white dark:bg-black">
          <StrategyPanel
            strategies={strategyConfigs}
            selected={selected}
            legs={legs}
            currentPrice={currentPrice}
            dropdownOpen={dropdownOpen}
            onDropdownToggle={() => setDropdownOpen(!dropdownOpen)}
            onSelectStrategy={setSelected}
            onUpdateLeg={(legId, updates) => updateLeg(selected, legId, updates)}
            onRemoveLeg={(legId) => removeLeg(selected, legId)}
            onAddPosition={() => addPosition(selected)}
            onAddOrder={addOrder}
          />
        </div>
      )}
    </>
  );
}
