"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

export type ReusableAreaOption = {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  postalCode?: string | null;
  district?: string | null;
  estimatedHouseholds?: number | null;
  estimatedFlyers?: number | null;
  estimatedDistanceMeters?: number | null;
  coverageAreaSqm?: number | null;
  geoJson?: unknown;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMeters?: number | null;
};

type Props = {
  areas?: ReusableAreaOption[];
  initialGeoJson?: unknown;
  initialType?: string;
  initialHouseholds?: number | null;
  initialFlyers?: number | null;
  initialCoverageAreaSqm?: number | null;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
      LatLngBounds: new () => GoogleBounds;
      Polygon: new (options: Record<string, unknown>) => GooglePolygon;
      event: { addListener: (target: unknown, name: string, callback: (...args: unknown[]) => void) => void };
      drawing?: {
        OverlayType: { POLYGON: string };
        DrawingManager: new (options: Record<string, unknown>) => {
          setMap: (map: GoogleMap | null) => void;
          setDrawingMode: (mode: string | null) => void;
        };
      };
      geometry?: {
        spherical: {
          computeArea: (path: unknown) => number;
        };
      };
    };
  };
};

type GoogleMap = {
  fitBounds?: (bounds: GoogleBounds) => void;
  setCenter?: (position: LatLng) => void;
  setZoom?: (zoom: number) => void;
};

type GoogleBounds = {
  extend: (position: LatLng) => void;
};

type GooglePolygon = {
  setMap: (map: GoogleMap | null) => void;
  setEditable: (value: boolean) => void;
  setDraggable: (value: boolean) => void;
  getPath: () => {
    getArray: () => Array<{ lat: () => number; lng: () => number }>;
  };
};

type EditableFeatureCollection = {
  type: "FeatureCollection";
  features: unknown[];
};

const GOOGLE_MAPS_VERSION = "3.64";

function safeFeatureCollection(value: unknown): EditableFeatureCollection {
  if (!value || typeof value !== "object") return { type: "FeatureCollection", features: [] };
  const candidate = value as { type?: string; features?: unknown[] };
  if (candidate.type === "FeatureCollection" && Array.isArray(candidate.features)) {
    return { type: "FeatureCollection", features: candidate.features };
  }
  return { type: "FeatureCollection", features: [] };
}

function parseFeatureCollectionText(value: string) {
  try {
    return safeFeatureCollection(JSON.parse(value || "{}"));
  } catch {
    return { type: "FeatureCollection", features: [] } satisfies EditableFeatureCollection;
  }
}

function polygonToFeature(polygon: GooglePolygon) {
  const ring = polygon.getPath().getArray().map((point) => [point.lng(), point.lat()]);
  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

function featureToPath(feature: unknown): LatLng[] {
  const candidate = feature as { geometry?: { type?: string; coordinates?: number[][][] } };
  if (candidate.geometry?.type !== "Polygon" || !Array.isArray(candidate.geometry.coordinates?.[0])) return [];
  return candidate.geometry.coordinates[0]
    .map((point) => ({ lng: Number(point[0]), lat: Number(point[1]) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function fallbackAreaSqm(features: unknown[]) {
  return features.length * 250_000;
}

export function DistributionAreaEditor({
  areas = [],
  initialGeoJson,
  initialType = "POLYGON",
  initialHouseholds,
  initialFlyers,
  initialCoverageAreaSqm,
}: Props) {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const polygonsRef = useRef<GooglePolygon[]>([]);
  const selectedPolygonRef = useRef<GooglePolygon | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [areaType, setAreaType] = useState(initialType);
  const [geoJson, setGeoJson] = useState(safeFeatureCollection(initialGeoJson));
  const [households, setHouseholds] = useState(initialHouseholds ?? 0);
  const [estimatedFlyers, setEstimatedFlyers] = useState(initialFlyers ?? (initialHouseholds ? Math.ceil(initialHouseholds * 1.08) : 0));
  const [coverageAreaSqm, setCoverageAreaSqm] = useState(initialCoverageAreaSqm ?? 0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [radiusMeters, setRadiusMeters] = useState(1000);

  const areaPreview = useMemo(() => {
    const sqkm = coverageAreaSqm > 0 ? coverageAreaSqm / 1_000_000 : 0;
    return {
      sqkm: sqkm.toLocaleString("de-DE", { maximumFractionDigits: 2 }),
      distance: distanceMeters > 0 ? `${(distanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : "-",
    };
  }, [coverageAreaSqm, distanceMeters]);

  function updateFormField(name: string, value?: string | number | null) {
    const form = containerRef.current?.closest("form");
    const field = form?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`);
    if (field && value !== undefined && value !== null) {
      field.value = String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function syncFromPolygons() {
    const features = polygonsRef.current.map(polygonToFeature);
    const nextGeoJson: EditableFeatureCollection = { type: "FeatureCollection", features };
    const maps = (window as GoogleMapsWindow).google?.maps;
    const nextArea = maps?.geometry?.spherical
      ? polygonsRef.current.reduce((sum, polygon) => sum + maps.geometry!.spherical.computeArea(polygon.getPath()), 0)
      : fallbackAreaSqm(features);
    const nextHouseholds = households || Math.max(Math.round(nextArea / 95), 1);
    const nextFlyers = Math.ceil(nextHouseholds * 1.08);
    const nextDistance = Math.round(Math.sqrt(nextArea) * 3.2);
    setGeoJson(nextGeoJson);
    setCoverageAreaSqm(Math.round(nextArea));
    setHouseholds(nextHouseholds);
    setEstimatedFlyers(nextFlyers);
    setDistanceMeters(nextDistance);
    updateFormField("estimatedHouseholds", nextHouseholds);
    updateFormField("flyerQuantity", nextFlyers);
  }

  function fitPolygons() {
    const maps = (window as GoogleMapsWindow).google?.maps;
    if (!maps || !mapRef.current || polygonsRef.current.length === 0) return;
    const bounds = new maps.LatLngBounds();
    polygonsRef.current.forEach((polygon) => {
      polygon.getPath().getArray().forEach((point) => bounds.extend({ lat: point.lat(), lng: point.lng() }));
    });
    mapRef.current.fitBounds?.(bounds);
  }

  function attachPolygon(polygon: GooglePolygon) {
    const maps = (window as GoogleMapsWindow).google?.maps;
    polygon.setEditable(true);
    polygon.setDraggable(true);
    polygonsRef.current.push(polygon);
    selectedPolygonRef.current = polygon;
    maps?.event.addListener(polygon, "click", () => {
      selectedPolygonRef.current = polygon;
    });
    const path = polygon.getPath();
    for (const eventName of ["insert_at", "remove_at", "set_at"]) {
      maps?.event.addListener(path, eventName, syncFromPolygons);
    }
    maps?.event.addListener(polygon, "dragend", syncFromPolygons);
    syncFromPolygons();
    fitPolygons();
  }

  function clearPolygons() {
    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    polygonsRef.current = [];
    selectedPolygonRef.current = null;
    setGeoJson({ type: "FeatureCollection", features: [] });
    setCoverageAreaSqm(0);
    setDistanceMeters(0);
  }

  function deleteSelectedPolygon() {
    const selected = selectedPolygonRef.current;
    if (!selected) return;
    selected.setMap(null);
    polygonsRef.current = polygonsRef.current.filter((polygon) => polygon !== selected);
    selectedPolygonRef.current = polygonsRef.current[0] ?? null;
    syncFromPolygons();
    fitPolygons();
  }

  function applyArea(areaId: string) {
    setSelectedAreaId(areaId);
    const area = areas.find((candidate) => candidate.id === areaId);
    if (!area) return;
    setAreaType(area.type);
    setGeoJson(safeFeatureCollection(area.geoJson));
    setHouseholds(area.estimatedHouseholds ?? 0);
    setEstimatedFlyers(area.estimatedFlyers ?? area.estimatedHouseholds ?? 0);
    setCoverageAreaSqm(area.coverageAreaSqm ?? 0);
    setDistanceMeters(area.estimatedDistanceMeters ?? 0);
    setRadiusMeters(area.radiusMeters ?? 1000);
    updateFormField("targetAreaName", area.name);
    updateFormField("city", area.city);
    updateFormField("postalCode", area.postalCode);
    updateFormField("estimatedHouseholds", area.estimatedHouseholds);
    updateFormField("flyerQuantity", area.estimatedFlyers ?? area.estimatedHouseholds);
  }

  useEffect(() => {
    if (!browserKey) return;
    const win = window as GoogleMapsWindow;
    if (win.google?.maps?.drawing) {
      queueMicrotask(() => setLoaded(true));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=${GOOGLE_MAPS_VERSION}&libraries=drawing,geometry`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [browserKey]);

  useEffect(() => {
    if (!loaded || !containerRef.current) return;
    const maps = (window as GoogleMapsWindow).google?.maps;
    if (!maps) return;
    const map = new maps.Map(containerRef.current, {
      center: { lat: 50.3569, lng: 7.589 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    mapRef.current = map;
    const drawingManager = maps.drawing
      ? new maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            drawingModes: [maps.drawing.OverlayType.POLYGON],
          },
          polygonOptions: {
            editable: true,
            draggable: true,
            fillColor: "#176b36",
            fillOpacity: 0.16,
            strokeColor: "#176b36",
            strokeWeight: 2,
          },
        })
      : null;
    drawingManager?.setMap(map);
    if (drawingManager) {
      maps.event.addListener(drawingManager, "polygoncomplete", (polygon: unknown) => {
        drawingManager.setDrawingMode(null);
        attachPolygon(polygon as GooglePolygon);
      });
    }

    const features = safeFeatureCollection(geoJson).features;
    features.forEach((feature) => {
      const path = featureToPath(feature);
      if (path.length < 3) return;
      const polygon = new maps.Polygon({
        paths: path,
        map,
        editable: true,
        draggable: true,
        fillColor: "#176b36",
        fillOpacity: 0.16,
        strokeColor: "#176b36",
        strokeWeight: 2,
      });
      attachPolygon(polygon as unknown as GooglePolygon);
    });
    if (features.length === 0) {
      map.setCenter?.({ lat: 50.3569, lng: 7.589 });
      map.setZoom?.(12);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <section className="areaEditor">
      <input type="hidden" name="distributionAreaId" value={selectedAreaId} />
      <input type="hidden" name="areaType" value={areaType} />
      <input type="hidden" name="targetAreaGeoJson" value={JSON.stringify(geoJson)} />
      <input type="hidden" name="coverageAreaSqm" value={coverageAreaSqm || ""} />
      <input type="hidden" name="estimatedFlyers" value={estimatedFlyers || ""} />
      <input type="hidden" name="estimatedDistanceMeters" value={distanceMeters || ""} />
      <input type="hidden" name="radiusMeters" value={areaType === "RADIUS" ? radiusMeters : ""} />

      <div className="areaToolbar">
        <label>
          Wiederverwendbares Gebiet
          <select value={selectedAreaId} onChange={(event) => applyArea(event.target.value)}>
            <option value="">Manuell definieren</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gebietstyp
          <select value={areaType} onChange={(event) => setAreaType(event.target.value)}>
            <option value="POSTAL_CODE">PLZ</option>
            <option value="CITY">Stadt</option>
            <option value="DISTRICT">Ortsteil</option>
            <option value="POLYGON">Polygon</option>
            <option value="RADIUS">Radius</option>
          </select>
        </label>
        <label>
          Haushalte
          <input
            type="number"
            min="1"
            value={households || ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              setHouseholds(value);
              setEstimatedFlyers(Math.ceil(value * 1.08));
              updateFormField("estimatedHouseholds", value);
              updateFormField("flyerQuantity", Math.ceil(value * 1.08));
            }}
          />
        </label>
        <label>
          Radius Meter
          <input
            type="number"
            min="100"
            step="50"
            value={radiusMeters}
            onChange={(event) => setRadiusMeters(Number(event.target.value))}
            disabled={areaType !== "RADIUS"}
          />
        </label>
      </div>

      {browserKey ? (
        <div ref={containerRef} className="areaMap" />
      ) : (
        <div className="mapFallback">
          <strong>Kartenbearbeitung im Fallback-Modus</strong>
          <p>Gebiete können weiterhin gespeichert werden: als PLZ, Stadt, Ortsteil oder per GeoJSON.</p>
          <textarea
            aria-label="GeoJSON Fallback"
            value={JSON.stringify(geoJson, null, 2)}
            onChange={(event) => setGeoJson(parseFeatureCollectionText(event.target.value))}
          />
        </div>
      )}

      <div className="areaActions">
        <button type="button" onClick={fitPolygons}>Auto Zoom</button>
        <button type="button" onClick={deleteSelectedPolygon}>Polygon löschen</button>
        <button type="button" onClick={clearPolygons}>Alle löschen</button>
      </div>

      <div className="areaSummary">
        <span><strong>{areaPreview.sqkm}</strong> km²</span>
        <span><strong>{households || "-"}</strong> Haushalte</span>
        <span><strong>{estimatedFlyers || "-"}</strong> Flyer</span>
        <span><strong>{areaPreview.distance}</strong> geschätzte Strecke</span>
      </div>
    </section>
  );
}
