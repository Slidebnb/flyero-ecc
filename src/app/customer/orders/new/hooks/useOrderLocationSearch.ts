"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Suggestion } from "../orderWizardTypes";

type UseOrderLocationSearchOptions = {
  autocompleteEndpoint: string;
  query: string;
};

export function useOrderLocationSearch({
  autocompleteEndpoint,
  query,
}: UseOrderLocationSearchOptions): { suggestions: Suggestion[]; clearSuggestions: () => void } {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    const requestSequence = ++requestSequenceRef.current;
    const trimmedQuery = query.trim();
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (trimmedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      fetch(`${autocompleteEndpoint}?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (requestSequence !== requestSequenceRef.current) return;
          setSuggestions(Array.isArray(payload?.data) ? payload.data as Suggestion[] : []);
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== "AbortError" && requestSequence === requestSequenceRef.current) {
            setSuggestions([]);
          }
        });
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [autocompleteEndpoint, query]);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);
  return { suggestions, clearSuggestions };
}
