"use server";

import { bearerToken, requestToken } from "./token";

export interface FuturesContract {
  symbol: string;          // "/ESM6"
  displayName: string;     // "ESM6"
  expirationDate: string;  // "2026-06-20"
  streamerSymbol: string;  // "/ESM26:XCME"
  isActive: boolean;       // true = front month
}

export interface FuturesProcessedChain {
  expirations: string[];
  strikesByExpiration: Record<string, number[]>;
  symbolMap: Record<string, { occ: string; streamer: string }>;
  frontMonthStreamerSymbol: string;
  futuresContracts: FuturesContract[];
  expirationToContract: Record<string, string>; // option exp date → futures symbol
}

export const getFuturesOptionChain = async (
  productCode: string,
): Promise<FuturesProcessedChain> => {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error(
      "No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.",
    );
  }

  const headers = {
    Authorization: bearerToken(access_token),
    "User-Agent": "my-app/1.0",
  };

  // Fetch active futures instruments — provides streamer symbols and active-month flag
  const contractsBySymbol: Record<string, FuturesContract> = {};
  try {
    const futuresRes = await fetch(
      `${process.env.TASTY_BASE_URL}/instruments/futures?product-code=${productCode}`,
      { method: "GET", headers },
    );
    if (futuresRes.ok) {
      const { data } = await futuresRes.json();
      for (const item of data?.items ?? []) {
        const sym: string = item.symbol;
        contractsBySymbol[sym] = {
          symbol: sym,
          displayName: sym.replace(/^\//, ""),
          expirationDate: item["expiration-date"] ?? "",
          streamerSymbol: item["streamer-symbol"] ?? sym.replace(/^\//, "") + ":XCME",
          isActive: item["active-month"] === true,
        };
      }
    }
  } catch {
    // Fall through — contracts will be inferred from chain data
  }

  // Fetch futures options chain (nested format)
  const chainRes = await fetch(
    `${process.env.TASTY_BASE_URL}/futures-option-chains/${productCode}/nested`,
    { method: "GET", headers },
  );
  if (!chainRes.ok)
    throw new Error(
      `Future option chain API error for ${productCode}: ${chainRes.status}`,
    );

  const { data } = await chainRes.json();

  type RawExpiration = {
    "underlying-symbol": string;
    "expiration-date": string;
    "stops-trading-at"?: string;
    strikes: {
      "strike-price": string;
      call: string;
      put: string;
      "call-streamer-symbol"?: string;
      "put-streamer-symbol"?: string;
    }[];
  };

  const optionChains: { expirations: RawExpiration[] }[] =
    data?.["option-chains"] ?? [];

  const now = Date.now();
  const expirationSet = new Set<string>();
  const seenByExp: Record<string, Set<number>> = {};
  const symbolMap: Record<string, { occ: string; streamer: string }> = {};
  const expirationToContract: Record<string, string> = {};
  const usedContractSymbols = new Set<string>();

  for (const chain of optionChains) {
    for (const expiration of chain.expirations) {
      const exp = expiration["expiration-date"];
      const underlyingSymbol = expiration["underlying-symbol"]; // e.g. "/ESM6"

      const stopsAt = expiration["stops-trading-at"];
      if (stopsAt) {
        const t = Date.parse(stopsAt);
        if (!Number.isNaN(t) && t <= now) continue;
      }

      for (const strikeItem of expiration.strikes) {
        const strike = Math.round(Number(strikeItem["strike-price"]));
        if (!exp || strike <= 0) continue;

        expirationSet.add(exp);
        if (underlyingSymbol) {
          expirationToContract[exp] = underlyingSymbol;
          usedContractSymbols.add(underlyingSymbol);
        }

        if (!seenByExp[exp]) seenByExp[exp] = new Set();
        seenByExp[exp].add(strike);

        const callKey = `${exp}|${strike}|C`;
        const putKey = `${exp}|${strike}|P`;

        if (!symbolMap[callKey] && strikeItem.call) {
          symbolMap[callKey] = {
            occ: strikeItem.call,
            streamer: strikeItem["call-streamer-symbol"] ?? strikeItem.call,
          };
        }
        if (!symbolMap[putKey] && strikeItem.put) {
          symbolMap[putKey] = {
            occ: strikeItem.put,
            streamer: strikeItem["put-streamer-symbol"] ?? strikeItem.put,
          };
        }
      }
    }
  }

  if (!expirationSet.size) {
    throw new Error(`Future option chain returned no data for ${productCode}.`);
  }

  const expirations = [...expirationSet].sort();
  const strikesByExpiration: Record<string, number[]> = {};
  for (const [exp, set] of Object.entries(seenByExp)) {
    strikesByExpiration[exp] = [...set].sort((a, b) => a - b);
  }

  // Build ordered contracts list from those that appear in the chain
  const futuresContracts: FuturesContract[] = [...usedContractSymbols]
    .map((sym) => contractsBySymbol[sym] ?? {
      symbol: sym,
      displayName: sym.replace(/^\//, ""),
      expirationDate: "",
      streamerSymbol: sym.replace(/^\//, "") + ":XCME",
      isActive: false,
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  const frontMonth = futuresContracts.find((c) => c.isActive) ?? futuresContracts[0];
  const frontMonthStreamerSymbol = frontMonth?.streamerSymbol ?? `/${productCode}:XCME`;

  return {
    expirations,
    strikesByExpiration,
    symbolMap,
    frontMonthStreamerSymbol,
    futuresContracts,
    expirationToContract,
  };
};
