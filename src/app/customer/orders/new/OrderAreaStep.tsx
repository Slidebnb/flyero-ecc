"use client";

import type { RefObject } from "react";
import { Search } from "lucide-react";
import type { LocationResult, OrderAreaSegmentDraft, Suggestion } from "./orderWizardTypes";

type OrderAreaStepProps = {
  query: string;
  city: string;
  postalCode: string;
  street: string;
  houseNumber: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  suggestions: Suggestion[];
  showSuggestions: boolean;
  pendingLocation: LocationResult | null;
  boundarySelectionEnabled: boolean;
  areaSelectionMode: "boundary" | "draw";
  boundaryLayerAvailable: boolean;
  drawingPoints: Array<{ lat: number; lng: number }>;
  previewCoverageAreaSqm: number;
  areaSegmentsPayload: OrderAreaSegmentDraft[];
  areaSegments: OrderAreaSegmentDraft[];
  activeSegmentId: string | null;
  onQueryChange: (value: string) => void;
  onEnter: () => void;
  onSearch: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onApplyPendingLocation: () => void;
  onKeepCurrentArea: () => void;
  onApplyBoundary: () => void;
  onStartDrawing: () => void;
  onFinishDrawing: () => void;
  onSelectSegment: (segment: OrderAreaSegmentDraft) => void;
  onRemoveSegment: (segmentId: string) => void;
  onAddSegment: () => void;
  polygonSourceLabel: () => string;
};

export function OrderAreaStep({
  query,
  city,
  postalCode,
  street,
  houseNumber,
  searchInputRef,
  suggestions,
  showSuggestions,
  pendingLocation,
  boundarySelectionEnabled,
  areaSelectionMode,
  boundaryLayerAvailable,
  drawingPoints,
  previewCoverageAreaSqm,
  areaSegmentsPayload,
  areaSegments,
  activeSegmentId,
  onQueryChange,
  onEnter,
  onSearch,
  onFocus,
  onBlur,
  onApplySuggestion,
  onApplyPendingLocation,
  onKeepCurrentArea,
  onApplyBoundary,
  onStartDrawing,
  onFinishDrawing,
  onSelectSegment,
  onRemoveSegment,
  onAddSegment,
  polygonSourceLabel,
}: OrderAreaStepProps) {
  return (
    <section className="orderPanelBlock primary inlineStepBlock">
      <p className="orderStepHint">Gib eine Adresse oder PLZ ein. Danach kannst du das Gebiet direkt auf der Karte anpassen.</p>
      <label>
        PLZ, Ort oder Adresse
        <div className="searchInputShell">
          <input
            data-testid="order-location-input"
            value={query}
            ref={searchInputRef}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onEnter();
              }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder="z. B. PLZ, Ort oder Straße"
            autoComplete="off"
          />
          <button type="button" onClick={onSearch} aria-label="Adresse suchen"><Search aria-hidden="true" /></button>
        </div>
      </label>
      {showSuggestions && suggestions.length > 0 ? (
        <div className="orderSuggestions">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => onApplySuggestion(suggestion)}>
              <strong>{suggestion.label}</strong>
              <span>{suggestion.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="selectedLocationBar">
        <strong>{city ? `${postalCode} ${city}` : query ? query : "Noch kein Gebiet gewählt"}</strong>
        <span>{street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : query && !city ? "Ort wird gesucht ..." : "Du kannst die Fläche danach direkt auf der Karte anpassen."}</span>
      </div>
      {pendingLocation ? (
        <div className="replaceAreaNotice" role="alert">
          <strong>Dein Gebiet wurde auf der Karte angepasst.</strong>
          <p>Wenn du eine neue PLZ übernimmst, ersetzt sie dein aktuelles Gebiet.</p>
          <div>
            <button type="button" onClick={onApplyPendingLocation}>Neues Gebiet übernehmen</button>
            <button type="button" onClick={onKeepCurrentArea}>Aktuelles Gebiet behalten</button>
          </div>
        </div>
      ) : null}
      <div className="modeTabs areaSelectionTabs">
        {boundarySelectionEnabled ? (
          <button
            data-testid="order-select-boundary"
            type="button"
            className={areaSelectionMode === "boundary" ? "selected" : ""}
            onClick={onApplyBoundary}
          >
            Gebiet übernehmen
          </button>
        ) : null}
        <button data-testid="order-draw-area" type="button" className={areaSelectionMode === "draw" || !boundaryLayerAvailable ? "selected" : ""} onClick={onStartDrawing}>
          Gebiet auf der Karte zeichnen
        </button>
      </div>
      {areaSelectionMode === "draw" && drawingPoints.length >= 3 ? (
        <button data-testid="order-finish-drawing" type="button" className="orderDrawingFinish" onClick={onFinishDrawing}>
          Gebiet abschließen
        </button>
      ) : null}
      <small className="orderSegmentHint">
        {boundarySelectionEnabled
          ? "Für diesen Ort liegt eine gespeicherte Flächenkarte vor. Du kannst sie übernehmen oder dein Gebiet selbst zeichnen."
          : "Zeichne dein Verteilgebiet direkt auf der Karte. Du kannst die Fläche jederzeit anpassen."}
      </small>
      {areaSelectionMode === "draw" ? (
        <p className="orderDrawingGuide" role="note">
          Klicke auf der Karte nacheinander auf die Eckpunkte deines Gebiets. Sobald die Fläche geschlossen ist, wählst du „Gebiet abschließen“.
        </p>
      ) : null}
      <div className="savedAreaMini">
        <div>
          <span>Dein Verteilgebiet</span>
          <strong>{(previewCoverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</strong>
          <small>{polygonSourceLabel()}</small>
        </div>
        <div className="miniPolygon" aria-hidden="true" />
      </div>
      <div className="orderSegmentList" aria-label="Teilgebiete">
        <div className="orderSegmentListHeader">
          <span>Teilgebiete deiner Planung</span>
          <strong>{areaSegmentsPayload.length}</strong>
        </div>
        {areaSegments.map((segment, index) => (
          <div className={segment.id === activeSegmentId ? "orderSegmentRow active" : "orderSegmentRow"} key={segment.id}>
            <button type="button" onClick={() => onSelectSegment(segment)}>
              <span className="orderSegmentIndex">{index + 1}</span>
              <span>
                <strong>{segment.name || `Teilgebiet ${index + 1}`}</strong>
                <small>{[segment.postalCode, segment.city].filter(Boolean).join(" ") || "Noch nicht festgelegt"}</small>
              </span>
            </button>
            <button type="button" className="orderSegmentRemove" onClick={() => onRemoveSegment(segment.id)} aria-label={`${segment.name || "Teilgebiet"} entfernen`}>Entfernen</button>
          </div>
        ))}
        <button type="button" className="orderSegmentAdd" onClick={onAddSegment}>Teilgebiet hinzufügen</button>
        <small className="orderSegmentHint">Mehrere Orte und Stadtteile bleiben getrennt sichtbar und werden gemeinsam geplant.</small>
      </div>
    </section>
  );
}
