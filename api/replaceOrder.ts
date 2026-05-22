"use server";

import type { OrderPayload } from "@/lib/types";
import { bearerToken, requestToken } from "./token";

const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

export async function replaceOrder(
  orderId: string,
  payload: OrderPayload,
  accountId = DEFAULT_ACCOUNT,
): Promise<void> {
  const access_token = await requestToken();
  if (!access_token)
    throw new Error("No access token — check OAuth credentials.");

  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/orders/${orderId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: bearerToken(access_token),
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "my-app/1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; errors?: { message: string }[] };
    };
    const nested = body?.error?.errors;
    if (nested?.length) {
      throw new Error(nested.map((e) => e.message).join("\n"));
    }
    throw new Error(
      body?.error?.message ?? `Replace order error: ${res.status}`,
    );
  }
}
