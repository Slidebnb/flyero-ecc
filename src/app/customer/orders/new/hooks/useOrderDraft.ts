"use client";

import { useCallback, useEffect } from "react";
import type { OrderDraft } from "../orderWizardTypes";

type UseOrderDraftOptions = {
  draft: OrderDraft;
  draftRestored: boolean;
  draftStorageKey: string;
  isPublicPlanner: boolean;
  initialLocation?: { query?: string | null; postalCode?: string | null; city?: string | null } | null;
  city: string;
  postalCode: string;
  onStatusChange: (status: string) => void;
};

/** Persists only authenticated drafts; public planner state is visit-scoped. */
export function useOrderDraft({
  draft,
  draftRestored,
  draftStorageKey,
  isPublicPlanner,
  initialLocation,
  city,
  postalCode,
  onStatusChange,
}: UseOrderDraftOptions): { clearDraft: () => void } {
  useEffect(() => {
    if (!draftRestored) return;

    if (isPublicPlanner) {
      const expectedPostalCode = initialLocation?.postalCode
        ?? (initialLocation?.query && /^\d{5}$/.test(initialLocation.query) ? initialLocation.query : undefined);
      if (expectedPostalCode && postalCode !== expectedPostalCode) return;
      if (initialLocation?.city && city !== initialLocation.city) return;
      window.localStorage.removeItem(draftStorageKey);
      onStatusChange("Planung bleibt nur für diesen Besuch aktiv");
      return;
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    onStatusChange("Entwurf gespeichert");
  }, [city, draft, draftRestored, draftStorageKey, initialLocation, isPublicPlanner, onStatusChange, postalCode]);

  const clearDraft = useCallback(() => {
    window.localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  return { clearDraft };
}
