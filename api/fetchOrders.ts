"use server";

import type { Order, Leg } from "../lib/types";
import { bearerToken, requestToken } from "./token";

export interface FetchOrdersParams {
  startDate: string;
  endDate: string;
  accountId?: string;
}
const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

export async function fetchOrders({
  startDate,
  endDate,
  accountId = DEFAULT_ACCOUNT,
}: FetchOrdersParams): Promise<unknown> {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error(
      "No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.",
    );
  }
  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/orders?start-date=${startDate}&end-date=${endDate}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: bearerToken(access_token),
      "User-Agent": "my-app/1.0",
    },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`Orders API error: ${res.status}`);

  const data = await res.json();
  return data;
}

interface RawLeg {
  action: string;
  "instrument-type": string;
  quantity: number;
  "remaining-quantity": number;
  symbol: string;
  fills: unknown[];
}

interface RawOrder {
  id: number;
  "underlying-symbol": string;
  "order-type": string;
  status: string;
  price: string;
  "price-effect": string;
  "received-at": string;
  "time-in-force": string;
  "leg-count": number;
  size: number;
  legs: RawLeg[];
}

interface TastyworksResponse {
  data: { items: RawOrder[] };
  context: string;
  pagination: Record<string, unknown>;
}

// OCC symbol: "SPXW  260227C06990000" → root, YYMMDD, C/P, strike×1000
function parseOccSymbol(sym: string) {
  const trimmed = sym.replace(/\s+/g, "");
  const strike = Number(trimmed.slice(-8)) / 1000;
  const type = trimmed.slice(-9, -8) as "C" | "P";
  const dateStr = trimmed.slice(-15, -9);
  const yy = dateStr.slice(0, 2);
  const mm = dateStr.slice(2, 4);
  const dd = dateStr.slice(4, 6);
  const expiration = `20${yy}-${mm}-${dd}`;
  const daysToExpiry = Math.ceil(
    (new Date(expiration).getTime() - Date.now()) / 86_400_000,
  );
  return {
    strike,
    type: type === "P" ? ("Put" as const) : ("Call" as const),
    expiration,
    daysToExpiry: Math.max(daysToExpiry, 0),
  };
}

function mapLeg(leg: RawLeg, i: number, j: number) {
  const parsed = parseOccSymbol(leg.symbol);
  const isSell = leg.action.toLowerCase().startsWith("sell");
  return {
    id: `leg-${i}-${j}`,
    strike: parsed.strike,
    type: parsed.type,
    expiration: parsed.expiration,
    side: isSell ? ("Short" as const) : ("Long" as const),
    size: leg.quantity,
    price: 0,
    status: "Working" as const,
    daysToExpiry: parsed.daysToExpiry,
  };
}

function identifyStrategy(legs: Leg[]): string {
  if (legs.length === 0) return "Unknown";

  const sorted = [...legs].sort((a, b) => a.strike - b.strike);
  const allSameExpiry = sorted.every(
    (l) => l.expiration === sorted[0].expiration,
  );

  // Single leg
  if (legs.length === 1) {
    const { side, type } = legs[0];
    if (side === "Long" && type === "Call") return "Long Call";
    if (side === "Long" && type === "Put") return "Long Put";
    if (side === "Short" && type === "Call") return "Short Call";
    if (side === "Short" && type === "Put") return "Short Put";
  }

  // Two legs
  if (legs.length === 2) {
    const [a, b] = sorted;

    if (allSameExpiry) {
      if (a.type === b.type) {
        if (a.type === "Call") {
          if (a.side === "Long" && b.side === "Short")
            return "Bull Call Spread";
          if (a.side === "Short" && b.side === "Long")
            return "Bear Call Spread";
        } else {
          if (a.side === "Long" && b.side === "Short") return "Bull Put Spread";
          if (a.side === "Short" && b.side === "Long") return "Bear Put Spread";
        }
      } else {
        const call = sorted.find((l) => l.type === "Call")!;
        const put = sorted.find((l) => l.type === "Put")!;
        const sameStrike = a.strike === b.strike;
        if (sameStrike) {
          if (call.side === "Long" && put.side === "Long")
            return "Long Straddle";
          if (call.side === "Short" && put.side === "Short")
            return "Short Straddle";
        } else {
          if (call.side === "Long" && put.side === "Long")
            return "Long Strangle";
          if (call.side === "Short" && put.side === "Short")
            return "Short Strangle";
        }
      }
    } else {
      if (a.type === b.type) {
        if (a.strike === b.strike) return "Calendar Spread";
        return "Diagonal Spread";
      }
    }
  }

  // Three legs: Butterfly (API represents 1:2:1 as 3 entries with doubled middle qty)
  if (legs.length === 3 && allSameExpiry) {
    const allCalls = sorted.every((l) => l.type === "Call");
    const allPuts = sorted.every((l) => l.type === "Put");
    if (allCalls || allPuts) {
      const minSize = Math.min(...sorted.map((l) => l.size));
      const ratio = sorted.map((l) => l.size / minSize);
      if (ratio[0] === 1 && ratio[1] === 2 && ratio[2] === 1) {
        if (
          sorted[0].side === "Long" &&
          sorted[1].side === "Short" &&
          sorted[2].side === "Long"
        )
          return "Long Butterfly";
        if (
          sorted[0].side === "Short" &&
          sorted[1].side === "Long" &&
          sorted[2].side === "Short"
        )
          return "Short Butterfly";
      }
    }
  }

  // Four legs
  if (legs.length === 4) {
    const puts = sorted
      .filter((l) => l.type === "Put")
      .sort((a, b) => a.strike - b.strike);
    const calls = sorted
      .filter((l) => l.type === "Call")
      .sort((a, b) => a.strike - b.strike);

    if (allSameExpiry) {
      // Iron Condor / Iron Butterfly: 2 puts + 2 calls
      if (puts.length === 2 && calls.length === 2) {
        if (
          puts[0].side === "Long" &&
          puts[1].side === "Short" &&
          calls[0].side === "Short" &&
          calls[1].side === "Long"
        ) {
          if (puts[1].strike === calls[0].strike) return "Iron Butterfly";
          return "Iron Condor";
        }
      }

      // Condor: 4 same-type legs — Long A, Short B, Short C, Long D
      if (calls.length === 4 || puts.length === 4) {
        const quad = calls.length === 4 ? calls : puts;
        if (
          quad[0].side === "Long" &&
          quad[1].side === "Short" &&
          quad[2].side === "Short" &&
          quad[3].side === "Long"
        ) {
          return "Condor";
        }
      }
    } else {
      // Double Diagonal: 4 legs across 2 expirations
      // far put Long + near put Short + near call Short + far call Long
      const expirations = [...new Set(sorted.map((l) => l.expiration))].sort();
      if (expirations.length === 2) {
        const [nearExp, farExp] = expirations;
        const nearLegs = sorted.filter((l) => l.expiration === nearExp);
        const farLegs = sorted.filter((l) => l.expiration === farExp);
        if (nearLegs.length === 2 && farLegs.length === 2) {
          const nearPut = nearLegs.find((l) => l.type === "Put");
          const nearCall = nearLegs.find((l) => l.type === "Call");
          const farPut = farLegs.find((l) => l.type === "Put");
          const farCall = farLegs.find((l) => l.type === "Call");
          if (
            nearPut?.side === "Short" &&
            nearCall?.side === "Short" &&
            farPut?.side === "Long" &&
            farCall?.side === "Long"
          ) {
            return "Double Diagonal";
          }
        }
      }
    }
  }

  return "Custom";
}

export async function mapTastyworksResponseToOrders(
  response: unknown,
): Promise<Order[]> {
  const { data } = response as TastyworksResponse;
  if (!data?.items) return [];

  return data.items.map((o, i) => {
    const isCredit = o["price-effect"] === "Credit";
    const price = Number(o.price) * 100;
    const legs = o.legs.map((leg, j) => mapLeg(leg, i, j));
    return {
      id: String(o.id),
      symbol: o["underlying-symbol"],
      strategyName: identifyStrategy(legs),
      status: o.status,
      orderNumber: String(o.id),
      tif: o["time-in-force"],
      totalCost: isCredit ? -price : price,
      profitLoss: undefined,
      createdAt: new Date(o["received-at"]),
      legs,
    };
  });
}
