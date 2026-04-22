"use server";

import { bearerToken, requestToken } from "./token";

export interface ProcessedChain {
  strikes: number[];
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
  expirationToRoot: Record<string, string>;
}

// Some symbols have companion weekly-options root symbols that must be fetched separately.
const COMPANION_ROOTS: Partial<Record<string, string>> = {
  SPX: "SPXW",
};

async function fetchChainItems(
  symbol: string,
  access_token: string,
): Promise<{ "expiration-date": string; "strike-price": string; "root-symbol"?: string }[]> {
  const url = `${process.env.TASTY_BASE_URL}/option-chains/${symbol}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: bearerToken(access_token),
      "User-Agent": "my-app/1.0",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Option chain API error for ${symbol}: ${res.status}`);
  const { data } = await res.json();
  return data?.items ?? [];
}

export const getOptionChain = async (symbol: string): Promise<ProcessedChain> => {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error(
      "No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.",
    );
  }

  // Fetch primary symbol, then companion (e.g. SPXW for SPX weeklies) if it exists.
  const primaryItems = await fetchChainItems(symbol, access_token);
  if (!primaryItems.length) {
    throw new Error(`Option chain returned no data for ${symbol}.`);
  }

  let companionItems: typeof primaryItems = [];
  const companionRoot = COMPANION_ROOTS[symbol];
  if (companionRoot) {
    try {
      companionItems = await fetchChainItems(companionRoot, access_token);
    } catch {
      // Companion fetch is best-effort; continue without it.
    }
  }

  // Process on the server — avoids serializing thousands of raw contract
  // objects across the server-action boundary (which caused JSON truncation).
  const strikeSet = new Set<number>();
  const expirationSet = new Set<string>();
  const seenByExp: Record<string, Set<number>> = {};
  const expirationToRoot: Record<string, string> = {};

  // Primary items first so monthly dates get the primary root (e.g. "SPX").
  for (const item of [...primaryItems, ...companionItems]) {
    const exp = item["expiration-date"];
    const strike = Math.round(Number(item["strike-price"]));
    if (!exp || strike <= 0) continue;

    strikeSet.add(strike);
    expirationSet.add(exp);

    // First-write wins: primary items set the root for shared monthly dates.
    if (!expirationToRoot[exp]) {
      expirationToRoot[exp] = item["root-symbol"] ?? symbol;
    }

    if (!seenByExp[exp]) seenByExp[exp] = new Set();
    seenByExp[exp].add(strike);
  }

  const strikes = [...strikeSet].sort((a, b) => a - b);
  const expirations = [...expirationSet].sort();
  const strikesByExpiration: Record<string, number[]> = {};
  for (const [exp, set] of Object.entries(seenByExp)) {
    strikesByExpiration[exp] = [...set].sort((a, b) => a - b);
  }

  return { strikes, expirations, strikesByExpiration, expirationToRoot };
};
