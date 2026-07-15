"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

type Suggestion = {
  id: string;
  label: string;
  description?: string | null;
  city?: string | null;
  postalCode?: string | null;
};

export function PublicPlannerSearch() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || selected?.label === value) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/public/planner/autocomplete?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => setSuggestions(payload?.data ?? []))
        .catch((error) => {
          if (error?.name !== "AbortError") setSuggestions([]);
        })
        .finally(() => setLoading(false));
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  function chooseSuggestion(suggestion: Suggestion) {
    setQuery(suggestion.label);
    setSelected(suggestion);
    setSuggestions([]);
    setOpen(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!query.trim()) {
      event.preventDefault();
      setOpen(true);
    }
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
              setSuggestions([]);
              setLoading(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            placeholder="z. B. 56068 Koblenz"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open && suggestions.length > 0}
            aria-controls="public-planner-suggestions"
          />
          {open && suggestions.length > 0 ? (
            <div id="public-planner-suggestions" className="mkPlannerSuggestions" role="listbox">
              {suggestions.map((suggestion) => (
                <button key={suggestion.id} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}>
                  <strong>{[suggestion.postalCode, suggestion.city].filter(Boolean).join(" ") || suggestion.label}</strong>
                  <span>{suggestion.description || suggestion.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button type="submit">Gebiet ansehen</button>
      </div>
      {loading ? <p className="mkPlannerSearchHint" role="status">Ort wird gesucht ...</p> : null}
      {selected?.city ? (
        <p className="mkPlannerSearchHint mkPlannerSearchSelected" role="status">
          Gefunden: {[selected.postalCode, selected.city].filter(Boolean).join(" ")}
        </p>
      ) : null}
    </form>
  );
}
