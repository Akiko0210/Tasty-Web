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
import { getBalance } from "@/api/balance";

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
  const [balance, setBalance] = useState<number>(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    getBalance().then((b) => {
      if (b != null) setBalance(Number(b));
    }).catch(() => {});
  }, []);

  const createSampleOrders = useCallback((): Order[] => {
    const now = new Date();
    return [
      {
        id: "order-1",
        symbol: "SPX",
        strategyName: "Vertical",
        status: "Canceled",
        orderNumber: "#438657147",
        tif: "Day",
        legs: [
          {
            id: "leg-1",
            strike: 6925,
            type: "Put",
            expiration: "Feb 27",
            side: "Short",
            size: 2,
            price: 9.4,
            status: "Canceled",
            daysToExpiry: 16,
          },
          {
            id: "leg-2",
            strike: 6900,
            type: "Put",
            expiration: "Feb 27",
            side: "Long",
            size: 2,
            price: 9.4,
            status: "Canceled",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
        totalCost: -150,
      },
      {
        id: "order-2",
        symbol: "SPX",
        strategyName: "Butterfly",
        status: "Canceled",
        orderNumber: "#438658358",
        tif: "Day",
        legs: [
          {
            id: "leg-3",
            strike: 6860,
            type: "Call",
            expiration: "Feb 27",
            side: "Long",
            size: 3,
            price: 11.2,
            status: "Canceled",
            daysToExpiry: 16,
          },
          {
            id: "leg-4",
            strike: 6930,
            type: "Call",
            expiration: "Feb 27",
            side: "Short",
            size: 6,
            price: 11.2,
            status: "Canceled",
            daysToExpiry: 16,
          },
          {
            id: "leg-5",
            strike: 6990,
            type: "Call",
            expiration: "Feb 27",
            side: "Long",
            size: 3,
            price: 11.2,
            status: "Canceled",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        totalCost: -111,
        profitLoss: 234.5,
      },
      {
        id: "order-3",
        symbol: "SPX",
        strategyName: "Iron Condor",
        status: "Filled",
        orderNumber: "#438659001",
        tif: "Day",
        legs: [
          {
            id: "leg-6",
            strike: 6830,
            type: "Put",
            expiration: "Feb 27",
            side: "Long",
            size: 1,
            price: 4.2,
            status: "Filled",
            daysToExpiry: 16,
          },
          {
            id: "leg-7",
            strike: 6850,
            type: "Put",
            expiration: "Feb 27",
            side: "Short",
            size: 1,
            price: 5.1,
            status: "Filled",
            daysToExpiry: 16,
          },
          {
            id: "leg-8",
            strike: 6930,
            type: "Call",
            expiration: "Feb 27",
            side: "Short",
            size: 1,
            price: 5.0,
            status: "Filled",
            daysToExpiry: 16,
          },
          {
            id: "leg-9",
            strike: 6950,
            type: "Call",
            expiration: "Feb 27",
            side: "Long",
            size: 1,
            price: 4.0,
            status: "Filled",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        totalCost: -10,
        profitLoss: 890,
      },
      {
        id: "order-4",
        symbol: "SPX",
        strategyName: "Vertical",
        status: "Working",
        orderNumber: "#438660100",
        tif: "Day",
        legs: [
          {
            id: "leg-10",
            strike: 6870,
            type: "Call",
            expiration: "Feb 27",
            side: "Long",
            size: 1,
            price: 7.77,
            status: "Working",
            daysToExpiry: 16,
          },
          {
            id: "leg-11",
            strike: 6910,
            type: "Call",
            expiration: "Feb 27",
            side: "Short",
            size: 1,
            price: 6.27,
            status: "Working",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
        totalCost: -150,
      },
      {
        id: "order-5",
        symbol: "SPX",
        strategyName: "Vertical",
        status: "Filled",
        orderNumber: "#438661200",
        tif: "Day",
        legs: [
          {
            id: "leg-12",
            strike: 6890,
            type: "Call",
            expiration: "Feb 27",
            side: "Long",
            size: 1,
            price: 11.2,
            status: "Filled",
            daysToExpiry: 16,
          },
          {
            id: "leg-13",
            strike: 6910,
            type: "Call",
            expiration: "Feb 27",
            side: "Short",
            size: 1,
            price: 9.44,
            status: "Filled",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        totalCost: 176,
        profitLoss: -45,
      },
      {
        id: "order-6",
        symbol: "SPX",
        strategyName: "Vertical",
        status: "Working",
        orderNumber: "#438662300",
        tif: "Day",
        legs: [
          {
            id: "leg-14",
            strike: 6850,
            type: "Put",
            expiration: "Feb 27",
            side: "Long",
            size: 2,
            price: 5.1,
            status: "Working",
            daysToExpiry: 16,
          },
          {
            id: "leg-15",
            strike: 6830,
            type: "Put",
            expiration: "Feb 27",
            side: "Short",
            size: 2,
            price: 3.52,
            status: "Working",
            daysToExpiry: 16,
          },
        ],
        createdAt: new Date(now.getTime() - 15 * 60 * 1000),
        totalCost: 316,
      },
    ];
  }, []);

  useEffect(() => {
    setOrders(createSampleOrders());
  }, [createSampleOrders]);

  const cancelOrder = useCallback(
    (orderId: string) => {
      setOrders((prev) => {
        const order = prev.find((o) => o.id === orderId);
        if (!order || order.status !== "Working") return prev;
        setBalance((b) => b - order.totalCost);
        return prev.map((o) =>
          o.id === orderId ? { ...o, status: "Cancelled" } : o,
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
