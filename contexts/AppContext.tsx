"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import { getBalance } from "@/api/balance";

interface AppContextType {
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  selected: number | null;
  setSelected: Dispatch<SetStateAction<number | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    getBalance()
      .then((b) => {
        if (b != null) setBalance(Number(b));
      })
      .catch(() => {});
  }, []);

  return (
    <AppContext.Provider value={{ balance, setBalance, selected, setSelected }}>
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
