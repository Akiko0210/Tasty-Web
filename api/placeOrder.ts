"use server";

import type { OrderPayload, DryRunResult, PlaceOrderResult } from "@/lib/types";
import { bearerToken, requestToken } from "./token";

const DEFAULT_ACCOUNT = process.env.TASTYWORKS_ACCOUNT_ID;

async function postToOrdersApi(
  path: "orders/dry-run" | "orders",
  payload: OrderPayload,
  accountId = DEFAULT_ACCOUNT,
): Promise<unknown> {
  const access_token = await requestToken();
  if (!access_token)
    throw new Error("No access token — check OAuth credentials.");

  const url = `${process.env.TASTY_BASE_URL}/accounts/${accountId}/${path}`;
  const res = await fetch(url, {
    method: "POST",
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
    console.error(
      `\n[${path}] ${res.status} failed\n--- Payload ---\n${JSON.stringify(payload, null, 2)}\n--- Response ---\n${JSON.stringify(body, null, 2)}\n`,
    );
    // Surface each specific preflight failure, not just the outer message
    const nested = body?.error?.errors;
    if (nested?.length) {
      throw new Error(nested.map((e) => e.message).join("\n"));
    }
    throw new Error(body?.error?.message ?? `Orders API error: ${res.status}`);
  }

  return (await res.json()).data;
}

export async function dryRunOrder(
  payload: OrderPayload,
): Promise<DryRunResult> {
  return postToOrdersApi("orders/dry-run", payload) as Promise<DryRunResult>;
}

export async function submitOrder(
  payload: OrderPayload,
): Promise<PlaceOrderResult> {
  return postToOrdersApi("orders", payload) as Promise<PlaceOrderResult>;
}
