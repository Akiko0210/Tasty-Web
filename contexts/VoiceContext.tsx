"use client";

import { createContext, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import type { VoiceTicketApi, VoiceOrdersApi } from "@/lib/voice/types";

// Lets the active order-ticket page expose an imperative API that the always-on
// VoiceAgent can drive, without lifting the ticket's local state out of the page.

interface VoiceContextValue {
  ticketRef: MutableRefObject<VoiceTicketApi | null>;
  ordersRef: MutableRefObject<VoiceOrdersApi | null>;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const ticketRef = useRef<VoiceTicketApi | null>(null);
  const ordersRef = useRef<VoiceOrdersApi | null>(null);
  return <VoiceContext.Provider value={{ ticketRef, ordersRef }}>{children}</VoiceContext.Provider>;
}

function useVoiceContext(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("Voice hooks must be used within a VoiceProvider");
  return ctx;
}

export function useVoiceTicketRef(): MutableRefObject<VoiceTicketApi | null> {
  return useVoiceContext().ticketRef;
}

export function useVoiceOrdersRef(): MutableRefObject<VoiceOrdersApi | null> {
  return useVoiceContext().ordersRef;
}

export function useRegisterVoiceTicket(api: VoiceTicketApi): void {
  const { ticketRef } = useVoiceContext();
  useEffect(() => {
    ticketRef.current = api;
    return () => {
      if (ticketRef.current === api) ticketRef.current = null;
    };
  }, [api, ticketRef]);
}

export function useRegisterVoiceOrders(api: VoiceOrdersApi): void {
  const { ordersRef } = useVoiceContext();
  useEffect(() => {
    ordersRef.current = api;
    return () => {
      if (ordersRef.current === api) ordersRef.current = null;
    };
  }, [api, ordersRef]);
}
