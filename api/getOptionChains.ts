"use server";

import { bearerToken, requestToken } from "./token";

export interface ProcessedChain {
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
  symbolMap: Record<string, { occ: string; streamer: string }>;
}

const EXPIRATION_TYPE_PRIORITY: Record<string, number> = {
  Regular: 1,
  Quarterly: 2,
  "End-Of-Month": 3,
  Weekly: 4,
};

export const getOptionChain = async (
  symbol: string,
): Promise<ProcessedChain> => {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error(
      "No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.",
    );
  }

  const url = `${process.env.TASTY_BASE_URL}/option-chains/${symbol}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: bearerToken(access_token),
      "User-Agent": "my-app/1.0",
    },
    redirect: "follow",
  });
  if (!res.ok)
    throw new Error(`Option chain API error for ${symbol}: ${res.status}`);
  const { data } = await res.json();

  const allItems: {
    "expiration-date": string;
    "expiration-type": string;
    "option-type": string;
    "strike-price": string;
    symbol: string;
    "streamer-symbol": string;
    "stops-trading-at"?: string;
  }[] = data?.items ?? [];

  if (!allItems.length) {
    throw new Error(`Option chain returned no data for ${symbol}.`);
  }

  const now = Date.now();
  const items = allItems.filter((it) => {
    const stopsAt = it["stops-trading-at"];
    if (!stopsAt) return true;
    const t = Date.parse(stopsAt);
    return Number.isNaN(t) || t > now;
  });

  if (!items.length) {
    throw new Error(`Option chain has no live options for ${symbol}.`);
  }

  // For dates with multiple expiration-types, keep only the highest-priority one.
  // Priority: Regular (Monthly) → Quarterly → End-Of-Month → Weekly
  const bestTypeByExp: Record<string, string> = {};
  for (const item of items) {
    const exp = item["expiration-date"];
    const type = item["expiration-type"] ?? "Weekly";
    const priority = EXPIRATION_TYPE_PRIORITY[type] ?? 99;
    const current = bestTypeByExp[exp];
    if (
      current === undefined ||
      priority < (EXPIRATION_TYPE_PRIORITY[current] ?? 99)
    ) {
      bestTypeByExp[exp] = type;
    }
  }

  const expirationSet = new Set<string>();
  const seenByExp: Record<string, Set<number>> = {};
  const symbolMap: Record<string, { occ: string; streamer: string }> = {};

  for (const item of items) {
    const exp = item["expiration-date"];
    if (item["expiration-type"] !== bestTypeByExp[exp]) continue;

    const strike = Math.round(Number(item["strike-price"]));
    if (!exp || strike <= 0) continue;

    expirationSet.add(exp);

    if (!seenByExp[exp]) seenByExp[exp] = new Set();
    seenByExp[exp].add(strike);

    const key = `${exp}|${strike}|${item["option-type"]}`;
    if (!symbolMap[key] && item.symbol && item["streamer-symbol"]) {
      symbolMap[key] = { occ: item.symbol, streamer: item["streamer-symbol"] };
    }
  }

  const expirations = [...expirationSet].sort();
  const strikesByExpiration: Record<string, number[]> = {};
  for (const [exp, set] of Object.entries(seenByExp)) {
    strikesByExpiration[exp] = [...set].sort((a, b) => a - b);
  }

  return { expirations, strikesByExpiration, symbolMap };
};
