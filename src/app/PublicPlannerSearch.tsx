"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { isGermanPostalCode, publicLocationSearchParams } from "@/lib/publicLocationContext";

type Suggestion = {
  id: string;
  label: string;
  description?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: "google" | "local" | "manual";
};

export function PublicPlannerSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolvingSelection, setResolvingSelection] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const requestSequenceRef = useRef(0);
  const selectionSequenceRef = useRef(0);

  function track(eventType: string, data: Record<string, unknown> = {}) {
    void fetch("/api/public/planner/experience", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, ...data }),
      keepalive: true,
    }).catch(() => undefined);
  }

  useEffect(() => {
    const value = query.trim();
    const requestSequence = ++requestSequenceRef.current;
    if (value.length < 2 || selected?.label === value || resolvingSelection) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/public/planner/autocomplete?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (requestSequence !== requestSequenceRef.current) return;
          setSuggestions(payload?.data ?? []);
        })
        .catch((error) => {
          if (requestSequence === requestSequenceRef.current && error?.name !== "AbortError") setSuggestions([]);
        })
        .finally(() => {
          if (requestSequence === requestSequenceRef.current) setLoading(false);
        });
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, resolvingSelection, selected]);

  async function chooseSuggestion(suggestion: Suggestion) {
    const selectionSequence = ++selectionSequenceRef.current;
    const selectedQuery = [suggestion.postalCode, suggestion.city].filter(Boolean).join(" ") || suggestion.label;
    setQuery(selectedQuery);
    setSelected(suggestion);
    setSuggestions([]);
    setOpen(false);
    setSelectionError("");
    setResolvingSelection(true);
    track("PUBLIC_AUTOCOMPLETE_SELECTED", {
      postalCode: suggestion.postalCode ?? undefined,
      city: suggestion.city ?? undefined,
      usedAutocomplete: true,
    });
    try {
      const params = new URLSearchParams({ q: selectedQuery });
      if (suggestion.source === "google") params.set("placeId", suggestion.id);
      if (suggestion.postalCode) params.set("postalCode", suggestion.postalCode);
      if (suggestion.city) params.set("city", suggestion.city);
      const response = await fetch(`/api/public/planner/geocode?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (selectionSequence !== selectionSequenceRef.current) return;
      if (!response.ok || !payload?.data) {
        setSelected(null);
        setSelectionError(payload?.error ?? "Der Ort konnte nicht eindeutig bestätigt werden.");
        return;
      }
      setSelected({
        ...suggestion,
        ...payload.data,
        id: payload.data.placeId ?? suggestion.id,
        label: suggestion.label,
        source: payload.data.source ?? suggestion.source,
      });
    } catch {
      if (selectionSequence === selectionSequenceRef.current) setSelectionError("Der Ort konnte gerade nicht bestätigt werden.");
    } finally {
      if (selectionSequence === selectionSequenceRef.current) setResolvingSelection(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!query.trim()) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (resolvingSelection) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const normalizedQuery = query.trim();
    const selectedForQuery = selected && (
      selected.label === normalizedQuery
      || (isGermanPostalCode(normalizedQuery) && selected.postalCode === normalizedQuery)
    ) ? selected : null;
    track("PUBLIC_SEARCH_SUBMITTED", {
      postalCode: selectedForQuery?.postalCode ?? undefined,
      city: selectedForQuery?.city ?? undefined,
      usedAutocomplete: Boolean(selectedForQuery),
    });
    const params = publicLocationSearchParams({
      query: selectedForQuery?.postalCode ?? query.trim(),
      placeId: selectedForQuery?.source === "google" ? selectedForQuery.id : undefined,
      postalCode: selectedForQuery?.postalCode ?? undefined,
      city: selectedForQuery?.city ?? undefined,
      lat: selectedForQuery?.lat ?? undefined,
      lng: selectedForQuery?.lng ?? undefined,
      source: selectedForQuery?.source,
    });
    window.location.assign(`/verteilung-planen?${params.toString()}`);
  }

  return (
    <form className="mkPlannerSearch" action="/verteilung-planen" method="get" onSubmit={submit}>
      <label htmlFor="public-planner-query">Adresse, Ort oder PLZ</label>
      <div className="mkPlannerSearchControls">
        <div className="mkPlannerSearchInputWrap">
          <input
            id="public-planner-query"
            name="query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              selectionSequenceRef.current += 1;
              setSelectionError("");
              setResolvingSelection(false);
              setSuggestions([]);
              setLoading(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder="z. B. PLZ, Ort oder Adresse"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            aria-controls="public-planner-suggestions"
          />
          {open && suggestions.length > 0 ? (
            <div id="public-planner-suggestions" className="mkPlannerSuggestions" role="listbox">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void chooseSuggestion(suggestion);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void chooseSuggestion(suggestion);
                    }
                  }}
                >
                  <strong>{[suggestion.postalCode, suggestion.city].filter(Boolean).join(" ") || suggestion.label}</strong>
                  <span>{suggestion.description || suggestion.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="submit" disabled={resolvingSelection} aria-busy={resolvingSelection}>Gebiet ansehen</button>
      </div>
      {loading ? <p className="mkPlannerSearchHint" role="status">Ort wird gesucht ...</p> : null}
      {resolvingSelection ? <p className="mkPlannerSearchHint" role="status">Ort wird bestätigt ...</p> : null}
      {selectionError ? <p className="mkPlannerSearchHint mkPlannerSearchError" role="alert">{selectionError}</p> : null}
      {selected?.city ? (
        <p className="mkPlannerSearchHint mkPlannerSearchSelected" role="status">
          Gefunden: {[selected.postalCode, selected.city].filter(Boolean).join(" ")}
        </p>
      ) : null}
    </form>
  );
}
