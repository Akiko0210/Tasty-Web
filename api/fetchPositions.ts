"use server";

import { bearerToken, requestToken } from "./token";

const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

// A trimmed, display-ready position. Only the fields worth showing on the
// positions page — the raw API row carries far more than is useful here.
export interface Position {
  id: string;
  underlying: string; // underlying ticker (SPX, AAPL, …)
  instrumentType: string; // "Equity Option", "Equity", "Future Option", …
  isOption: boolean;
  strike: number | null;
  optionType: "Call" | "Put" | null;
  expiration: string | null; // ISO YYYY-MM-DD
  daysToExpiry: number | null;
  quantity: number; // contracts/shares (magnitude)
  direction: "Long" | "Short" | "Zero";
  averageOpenPrice: number; // per share
  markPrice: number; // latest price per share (mark, else prior close)
  multiplier: number;
  marketValue: number; // current dollar value, signed by direction
  unrealizedPnl: number; // dollars, vs average open price
}

interface RawPosition {
  symbol: string;
  "instrument-type": string;
  "underlying-symbol": string;
  quantity: number | string;
  "quantity-direction": "Long" | "Short" | "Zero";
  "average-open-price": string;
  "close-price": string;
  mark?: string;
  "mark-price"?: string;
  multiplier: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// OCC symbol: "SPXW  260227C06990000" → strike, type, expiration, DTE.
function parseOccSymbol(sym: string) {
  const trimmed = sym.replace(/\s+/g, "");
  const strike = Number(trimmed.slice(-8)) / 1000;
  const type = trimmed.slice(-9, -8) as "C" | "P";
  const dateStr = trimmed.slice(-15, -9);
  const expiration = `20${dateStr.slice(0, 2)}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
  const daysToExpiry = Math.max(
    0,
    Math.ceil((new Date(expiration).getTime() - Date.now()) / 86_400_000),
  );
  return { strike, type: type === "P" ? ("Put" as const) : ("Call" as const), expiration, daysToExpiry };
}

function mapPosition(p: RawPosition): Position {
  const isOption = /option/i.test(p["instrument-type"]);
  const occ = isOption ? parseOccSymbol(p.symbol) : null;
  const multiplier = num(p.multiplier) || (isOption ? 100 : 1);
  const quantity = num(p.quantity);
  const direction = p["quantity-direction"];
  const sign = direction === "Short" ? -1 : 1;
  const averageOpenPrice = num(p["average-open-price"]);
  const markPrice = num(p["mark-price"] ?? p.mark) || num(p["close-price"]);

  const marketValue = markPrice * multiplier * quantity * sign;
  const costBasis = averageOpenPrice * multiplier * quantity * sign;
  const unrealizedPnl = marketValue - costBasis;

  return {
    id: p.symbol,
    underlying: p["underlying-symbol"],
    instrumentType: p["instrument-type"],
    isOption,
    strike: occ?.strike ?? null,
    optionType: occ?.type ?? null,
    expiration: occ?.expiration ?? null,
    daysToExpiry: occ?.daysToExpiry ?? null,
    quantity,
    direction,
    averageOpenPrice,
    markPrice,
    multiplier,
    marketValue,
    unrealizedPnl,
  };
}

export async function fetchPositions(accountId = DEFAULT_ACCOUNT): Promise<Position[]> {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error("No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.");
  }

  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/positions`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: bearerToken(access_token), "User-Agent": "my-app/1.0" },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`Positions API error: ${res.status}`);

  const { data } = await res.json();
  const items = (data?.items ?? []) as RawPosition[];
  return items
    .filter((p) => p["quantity-direction"] !== "Zero" && num(p.quantity) !== 0)
    .map(mapPosition)
    .sort((a, b) => a.underlying.localeCompare(b.underlying) || (a.strike ?? 0) - (b.strike ?? 0));
}
