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
import { getFuturesOptionChain } from "@/api/getFuturesChain";
import type { FuturesContract } from "@/api/getFuturesChain";
import { getQuotes } from "@/api/getQuotes";
import { fetchOrders, mapTastyworksResponseToOrders } from "@/api/fetchOrders";
import type { Order, Leg } from "@/lib/types";
import { FUTURES_PRODUCT_CODE } from "@/lib/constants";

// ---------- Quote stream ----------

export interface Quote {
  bid: number;
  ask: number;
  last?: number;
}

function useQuoteStream(symbols: string[]): Record<string, Quote> {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const wsRef = useRef<WebSocket | null>(null);
  // React state (not a ref) so the subscription effect below re-runs the moment
  // the channel opens — making the first subscription deterministic regardless
  // of whether the socket or the option-chain fetch wins the startup race.
  const [channelOpen, setChannelOpen] = useState(false);
  const symbolsKey = symbols.join(",");

  // ── Connection lifecycle — runs once per mount ──
  // `cancelled`, `ws`, and `reconnectTimer` are local to each effect invocation,
  // so the cleanup closes the exact socket this run created and the StrictMode
  // double-mount can't leak an orphaned, forever-reconnecting socket.
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      if (cancelled) return;

      let url: string;
      let initialToken: string;
      try {
        const res = await getQuotes();
        url = res["dxlink-url"];
        initialToken = res.token;
      } catch (e) {
        console.error("Failed to get quote token:", e);
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      if (cancelled) return;

      let currentToken = initialToken;
      ws = new WebSocket(url);
      wsRef.current = ws;
      const socket = ws;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "SETUP",
            channel: 0,
            keepaliveTimeout: 60,
            acceptKeepaliveTimeout: 60,
            version: "0.1",
          }),
        );
      };

      socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data as string);

        if (msg.type === "SETUP") {
          socket.send(JSON.stringify({ type: "AUTH", channel: 0, token: currentToken }));
        } else if (msg.type === "AUTH_STATE") {
          if (msg.state === "AUTHORIZED") {
            socket.send(
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
              socket.send(JSON.stringify({ type: "AUTH", channel: 0, token: currentToken }));
            } catch (e) {
              console.error("Failed to refresh quote token:", e);
            }
          }
        } else if (msg.type === "CHANNEL_OPENED" && msg.channel === 1) {
          socket.send(
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
          // Hand off to the subscription effect, which subscribes to the
          // current symbols (FEED_SETUP above is sent first, so ordering holds).
          if (!cancelled) setChannelOpen(true);
        } else if (msg.type === "FEED_DATA") {
          const [eventType, values] = msg.data as [string, (string | number)[]];
          if (eventType === "Quote") {
            setQuotes((prev) => {
              const next = { ...prev };
              for (let i = 0; i < values.length; i += 3) {
                const sym = values[i] as string;
                next[sym] = { ...prev[sym], bid: Number(values[i + 1]), ask: Number(values[i + 2]) };
              }
              return next;
            });
          } else if (eventType === "Trade") {
            setQuotes((prev) => {
              const next = { ...prev };
              for (let i = 0; i < values.length; i += 2) {
                const sym = values[i] as string;
                next[sym] = { ...prev[sym], bid: prev[sym]?.bid ?? 0, ask: prev[sym]?.ask ?? 0, last: Number(values[i + 1]) };
              }
              return next;
            });
          }
        } else if (msg.type === "KEEPALIVE") {
          socket.send(JSON.stringify({ type: "KEEPALIVE", channel: 0 }));
        }
      };

      socket.onerror = (e) => console.error("WebSocket error:", e);
      socket.onclose = () => {
        setChannelOpen(false);
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      setChannelOpen(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, []);

  // ── Subscription — re-runs whenever the symbol set changes OR the channel
  // (re)opens. This single source of truth replaces the old inline-subscribe +
  // ref-guarded effect, removing the startup race that left the first mount blank.
  useEffect(() => {
    if (!channelOpen || !wsRef.current) return;
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
  }, [symbolsKey, channelOpen]);

  return quotes;
}

// ---------- Context types ----------

export interface ChainData {
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
  symbolMap: Record<string, { occ: string; streamer: string }>;
  status: "loading" | "ready" | "error";
  error: string | null;
  underlyingStreamerSymbol?: string;
  futuresContracts?: FuturesContract[];
  expirationToContract?: Record<string, string>;
}

export type { FuturesContract };

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: Error | null;
  fetchedKey: string | null;
}

export interface PrefilledOrder {
  symbol: string;
  strategyName: string;
  legs: Leg[];
  tif: "Day" | "GTC";
  totalCost: number;
  replaceOrderId?: string;
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
  // Watchlist
  watchlist: string[];
  saveWatchlist: (symbols: string[]) => Promise<void>;
  // Orders
  ordersState: OrdersState;
  fetchOrdersRange: (startDate: string, endDate: string) => void;
  invalidateOrdersCache: () => void;
  // Order ticket prefill (Similar / Opposite / Replace)
  prefilledOrder: PrefilledOrder | null;
  setPrefilledOrder: (order: PrefilledOrder | null) => void;
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

  // Watchlist — persisted server-side
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((s: string[]) => setWatchlist(s))
      .catch(() => setWatchlist(["SPX", "/ES"]));
  }, []);

  const saveWatchlist = useCallback(async (symbols: string[]) => {
    setWatchlist(symbols);
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
    });
  }, []);

  // Prefilled order (Similar / Opposite / Replace flow)
  const [prefilledOrder, setPrefilledOrder] = useState<PrefilledOrder | null>(null);

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
      return { ...prev, [symbol]: { expirations: [], strikesByExpiration: {}, symbolMap: {}, status: "loading", error: null } };
    });

    const productCode = FUTURES_PRODUCT_CODE[symbol];
    const fetcher = productCode
      ? getFuturesOptionChain(productCode).then(
          ({ expirations, strikesByExpiration, symbolMap, frontMonthStreamerSymbol, futuresContracts, expirationToContract }) => ({
            expirations,
            strikesByExpiration,
            symbolMap,
            underlyingStreamerSymbol: frontMonthStreamerSymbol,
            futuresContracts,
            expirationToContract,
          }),
        )
      : getOptionChain(symbol).then(({ expirations, strikesByExpiration, symbolMap }) => ({
          expirations,
          strikesByExpiration,
          symbolMap,
          underlyingStreamerSymbol: undefined as string | undefined,
          futuresContracts: undefined as FuturesContract[] | undefined,
          expirationToContract: undefined as Record<string, string> | undefined,
        }));

    fetcher
      .then(({ expirations, strikesByExpiration, symbolMap, underlyingStreamerSymbol, futuresContracts, expirationToContract }) => {
        setChainCache((prev) => ({
          ...prev,
          [symbol]: { expirations, strikesByExpiration, symbolMap, status: "ready", error: null, underlyingStreamerSymbol, futuresContracts, expirationToContract },
        }));
      })
      .catch((e) => {
        console.error(`Failed to fetch chain for ${symbol}:`, e);
        const msg = e instanceof Error ? e.message : "Unknown error fetching option chain.";
        setChainCache((prev) => ({
          ...prev,
          [symbol]: { ...prev[symbol], status: "error", error: msg },
        }));
      });
  }, []);

  const invalidateOrdersCache = useCallback(() => {
    setOrdersState((prev) => ({ ...prev, fetchedKey: null }));
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
        watchlist,
        saveWatchlist,
        ordersState,
        fetchOrdersRange,
        invalidateOrdersCache,
        prefilledOrder,
        setPrefilledOrder,
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
