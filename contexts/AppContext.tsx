"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
} from "react";
import type { Order } from "@/lib/types";

interface AppContextType {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  orders: Order[];
  setOrders: Dispatch<SetStateAction<Order[]>>;
  selected: number | null;
  setSelected: Dispatch<SetStateAction<number | null>>;
  cancelOrder: (orderId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(50000);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const createSampleOrders = useCallback((): Order[] => {
    const now = new Date();
    return [
      {
        id: "order-live-1",
        strategyName: "Vertical",
        legs: [
          {
            id: "leg-1",
            strike: 687,
            type: "Call",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 7.77,
            status: "Working",
          },
          {
            id: "leg-2",
            strike: 691,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 6.27,
            status: "Partially filled",
          },
        ],
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        totalCost: -150,
      },
      {
        id: "order-filled-1",
        strategyName: "Butterfly",
        legs: [
          {
            id: "leg-3",
            strike: 687,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 7.77,
            status: "Filled",
          },
          {
            id: "leg-4",
            strike: 689,
            type: "Call",
            expiration: "Feb 6",
            side: "Long",
            size: 2,
            price: 7.44,
            status: "Filled",
          },
          {
            id: "leg-5",
            strike: 691,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 6.27,
            status: "Filled",
          },
        ],
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        totalCost: -111,
        profitLoss: 234.5,
      },
      {
        id: "order-completed-1",
        strategyName: "Iron Condor",
        legs: [
          {
            id: "leg-6",
            strike: 683,
            type: "Put",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 4.2,
            status: "Filled",
          },
          {
            id: "leg-7",
            strike: 685,
            type: "Put",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 5.1,
            status: "Filled",
          },
          {
            id: "leg-8",
            strike: 693,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 5.0,
            status: "Filled",
          },
          {
            id: "leg-9",
            strike: 695,
            type: "Call",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 4.0,
            status: "Filled",
          },
        ],
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        totalCost: -10,
        profitLoss: 890,
      },
      {
        id: "order-expired-1",
        strategyName: "Calendar",
        legs: [
          {
            id: "leg-10",
            strike: 689,
            type: "Call",
            expiration: "Mar 6",
            side: "Long",
            size: 1,
            price: 9.2,
            status: "Expired",
          },
          {
            id: "leg-11",
            strike: 689,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 7.44,
            status: "Expired",
          },
        ],
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        totalCost: -176,
        profitLoss: -125.5,
      },
      {
        id: "order-draft-1",
        strategyName: "Condor",
        legs: [
          {
            id: "leg-12",
            strike: 685,
            type: "Call",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 8.5,
            status: "Working",
          },
          {
            id: "leg-13",
            strike: 687,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 7.77,
            status: "Working",
          },
          {
            id: "leg-14",
            strike: 691,
            type: "Call",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 6.27,
            status: "Working",
          },
          {
            id: "leg-15",
            strike: 693,
            type: "Call",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 5.1,
            status: "Working",
          },
        ],
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
        totalCost: -10,
      },
      {
        id: "order-rejected-1",
        strategyName: "Vertical",
        legs: [
          {
            id: "leg-16",
            strike: 689,
            type: "Put",
            expiration: "Feb 6",
            side: "Long",
            size: 1,
            price: 12.0,
            status: "Rejected",
          },
          {
            id: "leg-17",
            strike: 693,
            type: "Put",
            expiration: "Feb 6",
            side: "Short",
            size: 1,
            price: 8.0,
            status: "Rejected",
          },
        ],
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
        totalCost: -400,
      },
    ];
  }, []);

  const hydrateOrders = useCallback(() => {
    const stored = localStorage.getItem("orders");
    let existingOrders: Order[] = [];

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          existingOrders = parsed.map((o: any) => {
            const { status: _s, ...rest } = o;
            return { ...rest, createdAt: new Date(o.createdAt) };
          });
        }
      } catch {
        // ignore, we'll fall back to samples
      }
    }

    const sampleOrders = createSampleOrders();
    const sampleOrderIds = sampleOrders.map((o) => o.id);
    const hasAllSamples = sampleOrderIds.every((id) =>
      existingOrders.some((o) => o.id === id),
    );

    const merged = hasAllSamples
      ? existingOrders
      : [
          ...existingOrders.filter((o) => !sampleOrderIds.includes(o.id)),
          ...sampleOrders,
        ];

    setOrders(merged);
    localStorage.setItem("orders", JSON.stringify(merged));
  }, [createSampleOrders]);

  useEffect(() => {
    hydrateOrders();

    function onStorage(e: StorageEvent) {
      if (e.key !== "orders") return;
      hydrateOrders();
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrateOrders]);

  useEffect(() => {
    if (orders.length === 0) return;
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  const cancelOrder = useCallback(
    (orderId: string) => {
      setOrders((prev) => {
        const order = prev.find((o) => o.id === orderId);
        const canCancel = order?.legs.some(
          (l) => l.status === "Working" || l.status === "Partially filled",
        );
        if (!order || !canCancel) return prev;
        setBalance((b) => b - order.totalCost);
        return prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                legs: o.legs.map((l) =>
                  l.status === "Working" || l.status === "Partially filled"
                    ? { ...l, status: "Canceled" as const }
                    : l,
                ),
              }
            : o,
        );
      });
    },
    [setOrders, setBalance],
  );

  return (
    <AppContext.Provider
      value={{
        balance,
        setBalance,
        orders,
        setOrders,
        selected,
        setSelected,
        cancelOrder,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
