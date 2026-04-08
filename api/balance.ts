"use server";

import { bearerToken, requestToken } from "./token";

const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

export const getBalance = async (accountId = DEFAULT_ACCOUNT) => {
  const access_token = await requestToken();
  if (!access_token) {
    throw new Error(
      "No access token: check REFRESH_TOKEN / CLIENT_SECRET and OAuth response.",
    );
  }

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: bearerToken(access_token),
      "User-Agent": "my-app/1.0",
    },
    redirect: "follow",
  };

  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/balances`;
  try {
    const res = await fetch(url, requestOptions);
    if (!res.ok) throw new Error(`Orders API error: ${res.status}`);

    const { data } = await res.json();
    return data["cash-balance"];
  } catch (error) {
    console.log(error, "error");
    throw error;
  }
};
