"use client";

/* eslint-disable react-hooks/set-state-in-effect -- The hook intentionally clears stale server results when its calculation inputs become incomplete. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Intelligence } from "../orderWizardTypes";

export type OrderIntelligenceStatus = "local" | "updating" | "live" | "error";

type UseOrderIntelligenceOptions = {
  endpoint: string;
  requestQuery: string;
  city: string;
  postalCode: string;
  coverageAreaSqm: number;
};

type UseOrderIntelligenceResult = {
  intelligence: Intelligence | null;
  intelligenceStatus: OrderIntelligenceStatus;
  isPending: boolean;
  isConfirmed: (requestQuery: string) => boolean;
  reset: () => void;
};

/**
 * Keeps the server-backed area and pricing calculation tied to the exact
 * request that produced it. Stale responses are ignored and a new request
 * cancels the previous one before the UI can submit an order.
 */
export function useOrderIntelligence({
  endpoint,
  requestQuery,
  city,
  postalCode,
  coverageAreaSqm,
}: UseOrderIntelligenceOptions): UseOrderIntelligenceResult {
  const [isPending, setIsPending] = useState(false);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState<OrderIntelligenceStatus>("local");
  const lastRequestRef = useRef<string | null>(null);
  const confirmedRequestRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Official municipality boundaries do not belong to one postal code.
    // The city plus the committed geometry is sufficient for server pricing.
    if (!city || coverageAreaSqm <= 0) {
      lastRequestRef.current = requestQuery;
      confirmedRequestRef.current = null;
      abortRef.current?.abort();
      setIntelligence(null);
      setIntelligenceStatus("local");
      setIsPending(false);
      return;
    }

    if (lastRequestRef.current === requestQuery) return;

    lastRequestRef.current = requestQuery;
    confirmedRequestRef.current = null;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    setIntelligence(null);
    setIntelligenceStatus("updating");
    setIsPending(true);

    fetch(`${endpoint}?${requestQuery}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (lastRequestRef.current !== requestQuery) return;
        setIsPending(false);
        if (payload?.data) {
          setIntelligence(payload.data as Intelligence);
          confirmedRequestRef.current = requestQuery;
          setIntelligenceStatus("live");
        } else {
          setIntelligenceStatus("error");
        }
      })
      .catch((error: unknown) => {
        if (lastRequestRef.current === requestQuery && (timedOut || (error as { name?: string })?.name !== "AbortError")) {
          setIsPending(false);
          setIntelligenceStatus("error");
        }
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [city, coverageAreaSqm, endpoint, postalCode, requestQuery]);

  const isConfirmed = useCallback(
    (currentRequestQuery: string) => confirmedRequestRef.current === currentRequestQuery,
    [],
  );
  const reset = useCallback(() => {
    abortRef.current?.abort();
    lastRequestRef.current = null;
    confirmedRequestRef.current = null;
    setIntelligence(null);
    setIntelligenceStatus("local");
  }, []);

  return {
    intelligence,
    intelligenceStatus,
    isPending,
    isConfirmed,
    reset,
  };
}
