"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { getBalance } from "@/api/balance";
import { getOptionChain } from "@/api/getOptionChains";
import { getQuotes } from "@/api/getQuotes";
import { fetchOrders, mapTastyworksResponseToOrders } from "@/api/fetchOrders";
import type { Order } from "@/lib/types";

// ---------- Quote stream ----------

export interface Quote {
  bid: number;
  ask: number;
  last?: number;
}

function useQuoteStream(symbols: string[]): Record<string, Quote> {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const symbolsRef = useRef(symbols);
  const channelOpenRef = useRef(false);
  const cancelledRef = useRef(false);
  const symbolsKey = symbols.join(",");

  useEffect(() => {
    symbolsRef.current = symbols;
  });

  useEffect(() => {
    if (!channelOpenRef.current || !wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: "FEED_SUBSCRIPTION",
        channel: 1,
        reset: true,
        add: [
          ...symbols.map((s) => ({ type: "Quote", symbol: s })),
          ...symbols.map((s) => ({ type: "Trade", symbol: s })),
        ],
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  useEffect(() => {
    cancelledRef.current = false;

    async function connect() {
      if (cancelledRef.current) return;
      const { "dxlink-url": url, token: initialToken } = await getQuotes();
      if (cancelledRef.current) return;

      let currentToken = initialToken;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "SETUP",
            channel: 0,
            keepaliveTimeout: 60,
            acceptKeepaliveTimeout: 60,
            version: "0.1",
          }),
        );
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "SETUP") {
          ws.send(JSON.stringify({ type: "AUTH", channel: 0, token: currentToken }));
        } else if (msg.type === "AUTH_STATE") {
          if (msg.state === "AUTHORIZED") {
            ws.send(
              JSON.stringify({
                type: "CHANNEL_REQUEST",
                channel: 1,
                service: "FEED",
                parameters: { contract: "AUTO" },
              }),
            );
          } else if (msg.state === "UNAUTHORIZED") {
            try {
              const { token: newToken } = await getQuotes();
              currentToken = newToken;
              ws.send(JSON.stringify({ type: "AUTH", channel: 0, token: currentToken }));
            } catch (e) {
              console.error("Failed to refresh quote token:", e);
            }
          }
        } else if (msg.type === "CHANNEL_OPENED" && msg.channel === 1) {
          channelOpenRef.current = true;
          ws.send(
            JSON.stringify({
              type: "FEED_SETUP",
              channel: 1,
              acceptAggregationPeriod: 0,
              acceptDataFormat: "COMPACT",
              acceptEventFields: {
            Quote: ["eventSymbol", "bidPrice", "askPrice"],
            Trade: ["eventSymbol", "price"],
          },
            }),
          );
          ws.send(
            JSON.stringify({
              type: "FEED_SUBSCRIPTION",
              channel: 1,
              reset: true,
              add: [
                ...symbolsRef.current.map((s) => ({ type: "Quote", symbol: s })),
                ...symbolsRef.current.map((s) => ({ type: "Trade", symbol: s })),
              ],
            }),
          );
        } else if (msg.type === "FEED_DATA") {
          const [eventType, values] = msg.data as [string, (string | number)[]];
          if (eventType === "Quote") {
            setQuotes((prev) => {
              const next = { ...prev };
              for (let i = 0; i < values.length; i += 3) {
                const sym = values[i] as string;
                next[sym] = { ...prev[sym], bid: values[i + 1] as number, ask: values[i + 2] as number };
              }
              return next;
            });
          } else if (eventType === "Trade") {
            setQuotes((prev) => {
              const next = { ...prev };
              for (let i = 0; i < values.length; i += 2) {
                const sym = values[i] as string;
                next[sym] = { ...prev[sym], bid: prev[sym]?.bid ?? 0, ask: prev[sym]?.ask ?? 0, last: values[i + 1] as number };
              }
              return next;
            });
          }
        } else if (msg.type === "KEEPALIVE") {
          ws.send(JSON.stringify({ type: "KEEPALIVE", channel: 0 }));
        }
      };

      ws.onerror = (e) => console.error("WebSocket error:", e);
      ws.onclose = () => {
        channelOpenRef.current = false;
        if (!cancelledRef.current) setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      cancelledRef.current = true;
      channelOpenRef.current = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  return quotes;
}

// ---------- Context types ----------

export interface ChainData {
  strikes: number[];
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
  status: "loading" | "ready" | "error";
  error: string | null;
}

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: Error | null;
  fetchedKey: string | null;
}

interface AppContextType {
  // Account
  balance: number;
  setBalance: Dispatch<SetStateAction<number>>;
  selected: number | null;
  setSelected: Dispatch<SetStateAction<number | null>>;
  // Option chain
  chainCache: Record<string, ChainData>;
  fetchOptionChainForSymbol: (symbol: string) => void;
  // Quotes
  quotes: Record<string, Quote>;
  setQuoteSymbols: Dispatch<SetStateAction<string[]>>;
  // Orders
  ordersState: OrdersState;
  fetchOrdersRange: (startDate: string, endDate: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ---------- Provider ----------

export function AppProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Option chain — cached per symbol
  const [chainCache, setChainCache] = useState<Record<string, ChainData>>({});

  // Quotes
  const [quoteSymbols, setQuoteSymbols] = useState<string[]>(["SPX"]);
  const quotes = useQuoteStream(quoteSymbols);

  // Orders
  const [ordersState, setOrdersState] = useState<OrdersState>({
    orders: [],
    loading: false,
    error: null,
    fetchedKey: null,
  });

  // Balance
  useEffect(() => {
    getBalance()
      .then((b) => { if (b != null) setBalance(Number(b)); })
      .catch(() => {});
  }, []);

  // Option chain — fetch for a symbol only if not already cached
  const fetchOptionChainForSymbol = useCallback((symbol: string) => {
    setChainCache((prev) => {
      if (prev[symbol]?.status === "ready") return prev;
      return { ...prev, [symbol]: { strikes: [], expirations: [], strikesByExpiration: {}, status: "loading", error: null } };
    });

    getOptionChain(symbol)
      .then(({ strikes, expirations, strikesByExpiration }) => {
        setChainCache((prev) => ({
          ...prev,
          [symbol]: { strikes, expirations, strikesByExpiration, status: "ready", error: null },
        }));
      })
      .catch((e) => {
        console.error(`Failed to fetch option chain for ${symbol}:`, e);
        const msg = e instanceof Error ? e.message : "Unknown error fetching option chain.";
        setChainCache((prev) => ({
          ...prev,
          [symbol]: { ...prev[symbol], status: "error", error: msg },
        }));
      });
  }, []);

  // Orders — only fetch when date range actually changes
  const fetchOrdersRange = useCallback(
    (startDate: string, endDate: string) => {
      const key = `${startDate}__${endDate}`;
      setOrdersState((prev) => {
        if (prev.fetchedKey === key && !prev.error) return prev;
        return { ...prev, loading: true, error: null };
      });

      // Run outside of setState to avoid async in reducer
      const key2 = key;
      (async () => {
        try {
          const raw = await fetchOrders({ startDate, endDate });
          const mapped = await mapTastyworksResponseToOrders(raw);
          setOrdersState({ orders: mapped, loading: false, error: null, fetchedKey: key2 });
        } catch (e) {
          setOrdersState((prev) => ({
            ...prev,
            loading: false,
            error: e instanceof Error ? e : new Error(String(e)),
            fetchedKey: key2,
          }));
        }
      })();
    },
    [],
  );

  return (
    <AppContext.Provider
      value={{
        balance,
        setBalance,
        selected,
        setSelected,
        chainCache,
        fetchOptionChainForSymbol,
        quotes,
        setQuoteSymbols,
        ordersState,
        fetchOrdersRange,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
