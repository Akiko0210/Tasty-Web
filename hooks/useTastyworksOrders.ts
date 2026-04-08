"use client";

import { useState, useEffect, useCallback } from "react";
import type { Order } from "@/lib/types";
import {
  fetchOrders,
  mapTastyworksResponseToOrders,
} from "@/api/fetchOrders";

export interface UseTastyworksOrdersParams {
  startDate: string;
  endDate: string;
  accountId?: string;
  authToken?: string;
  enabled?: boolean;
}

export function useTastyworksOrders({
  startDate,
  endDate,
  accountId,
  enabled = true,
}: UseTastyworksOrdersParams) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const hasDates = Boolean(startDate && endDate);

  const refetch = useCallback(async () => {
    // if (!startDate || !endDate || !enabled) {
    //   if (!hasDates) setOrders([]);
    //   return;
    // }
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchOrders({
        accountId,
        startDate,
        endDate,
      });
      setOrders(await mapTastyworksResponseToOrders(raw));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, startDate, endDate, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const usedApi = hasDates && enabled;
  return {
    orders,
    loading,
    error,
    refetch,
    usedApi,
  };
}
