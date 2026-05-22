"use server";

import { bearerToken, requestToken } from "./token";

const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

export async function cancelOrder(
  orderId: string,
  accountId = DEFAULT_ACCOUNT,
): Promise<void> {
  const access_token = await requestToken();
  if (!access_token)
    throw new Error("No access token — check OAuth credentials.");

  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/orders/${orderId}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: bearerToken(access_token),
      "User-Agent": "my-app/1.0",
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      body?.error?.message ?? `Cancel order error: ${res.status}`,
    );
  }
}
