"use server";

import { bearerToken, requestToken } from "./token";

export interface ProcessedChain {
  strikes: number[];
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
}

export const getOptionChain = async (symbol: string): Promise<ProcessedChain> => {
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

  if (!res.ok) throw new Error(`Option chain API error: ${res.status}`);

  const { data } = await res.json();
  const items: { "expiration-date": string; "strike-price": string }[] =
    data?.items ?? [];

  if (!items.length) {
    throw new Error(`Option chain returned no data for ${symbol}.`);
  }

  // Process on the server — avoids serializing thousands of raw contract
  // objects across the server-action boundary (which caused JSON truncation).
  const strikeSet = new Set<number>();
  const expirationSet = new Set<string>();
  const seenByExp: Record<string, Set<number>> = {};

  for (const item of items) {
    const exp = item["expiration-date"];
    const strike = Math.round(Number(item["strike-price"]));
    if (!exp || strike <= 0) continue;

    strikeSet.add(strike);
    expirationSet.add(exp);

    if (!seenByExp[exp]) seenByExp[exp] = new Set();
    seenByExp[exp].add(strike);
  }

  const strikes = [...strikeSet].sort((a, b) => a - b);
  const expirations = [...expirationSet].sort();
  const strikesByExpiration: Record<string, number[]> = {};
  for (const [exp, set] of Object.entries(seenByExp)) {
    strikesByExpiration[exp] = [...set].sort((a, b) => a - b);
  }

  return { strikes, expirations, strikesByExpiration };
};
