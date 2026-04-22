"use server";

import { bearerToken, requestToken } from "./token";

export const getQuotes = async () => {
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

  const url = `${process.env.TASTY_BASE_URL}/api-quote-tokens`;
  try {
    const res = await fetch(url, requestOptions);
    if (!res.ok) throw new Error(`Orders API error: ${res.status}`);

    const { data } = await res.json();
    return { "dxlink-url": data["dxlink-url"], token: data.token };
  } catch (error) {
    console.log(error, "error");
    throw error;
  }
};
