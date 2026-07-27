"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  geoJson?: unknown;
  height?: number;
};

type GoogleMapsWindow = Window & {
  __flyeroMapsLibrary?: GoogleMapsLibrary;
  __flyeroMapsLoading?: Promise<void>;
  google?: {
    maps: {
      Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
      LatLngBounds: new () => GoogleBounds;
      Polygon: new (options: Record<string, unknown>) => { setMap: (map: GoogleMap) => void };
      importLibrary?: (libraryName: string) => Promise<unknown>;
    };
  };
};

type GoogleMapsLibrary = {
  Map?: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  LatLngBounds?: new () => GoogleBounds;
  Polygon?: new (options: Record<string, unknown>) => { setMap: (map: GoogleMap) => void };
};

type GoogleMap = {
  fitBounds?: (bounds: GoogleBounds) => void;
};

type GoogleBounds = {
  extend: (position: { lat: number; lng: number }) => void;
};

type MapPoint = { lat: number; lng: number };

const GOOGLE_MAPS_VERSION = "3.64";

function features(value: unknown) {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return [];
    }
  }
  const parsed = candidate as { type?: string; features?: unknown[]; geometry?: unknown };
  if (parsed?.type === "FeatureCollection" && Array.isArray(parsed.features)) return parsed.features;
  if (parsed?.type === "Feature") return [parsed];
  if (parsed?.type === "Polygon" || parsed?.type === "MultiPolygon") return [{ type: "Feature", geometry: parsed }];
  return [];
}

function pathFromCoordinates(coordinates: unknown) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const candidate = { lat: Number(point[1]), lng: Number(point[0]) };
      return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng) ? candidate : null;
    })
    .filter((point): point is MapPoint => point !== null);
}

function pathsFromFeature(feature: unknown) {
  const candidate = feature as { geometry?: { type?: string; coordinates?: unknown } };
  const coordinates = candidate.geometry?.coordinates;
  if (candidate.geometry?.type === "Polygon") {
    const path = pathFromCoordinates(Array.isArray(coordinates) ? coordinates[0] : undefined);
    return path.length >= 3 ? [path] : [];
  }
  if (candidate.geometry?.type === "MultiPolygon" && Array.isArray(coordinates)) {
    return coordinates
      .map((polygon) => pathFromCoordinates(Array.isArray(polygon) ? polygon[0] : undefined))
      .filter((path) => path.length >= 3);
  }
  return [];
}

export function DistributionAreaPreviewMap({ geoJson, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [renderRetry, setRenderRetry] = useState(0);
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const areaFeatures = features(geoJson);
  const areaPaths = useMemo(() => areaFeatures.flatMap(pathsFromFeature), [areaFeatures]);

  useEffect(() => {
    if (!browserKey || areaFeatures.length === 0) return;
    const win = window as GoogleMapsWindow;
    if (win.google?.maps) {
      queueMicrotask(() => setLoaded(true));
      return;
    }
    let cancelled = false;
    const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps]");
    const loading = win.__flyeroMapsLoading ?? new Promise<void>((resolve, reject) => {
      const script = existing ?? document.createElement("script");
      const finish = () => win.google?.maps ? resolve() : reject(new Error("Google Maps wurde ohne API bereitgestellt."));
      const fail = () => reject(new Error("Google Maps konnte nicht geladen werden."));
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", fail, { once: true });
      if (!existing) {
        script.dataset.googleMaps = "true";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=${GOOGLE_MAPS_VERSION}&loading=async`;
        script.async = true;
        document.head.appendChild(script);
      } else if ((script as HTMLScriptElement & { readyState?: string }).readyState === "complete") {
        window.setTimeout(finish, 0);
      }
    });
    win.__flyeroMapsLoading = loading;
    loading.then(() => {
      if (!cancelled) {
        setMapError(false);
        setLoaded(true);
      }
    }).catch(() => {
      if (!cancelled) {
        win.__flyeroMapsLoading = undefined;
        if (loadRetry < 2) {
          window.setTimeout(() => setLoadRetry((value) => value + 1), 300);
        } else {
          setMapError(true);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [areaFeatures.length, browserKey, loadRetry]);

  useEffect(() => {
    if (!loaded || !containerRef.current || areaPaths.length === 0) return;
    let cancelled = false;
    async function renderMap() {
      try {
        await Promise.resolve();
        const maps = (window as GoogleMapsWindow).google?.maps;
        if (!maps) {
          setMapError(true);
          return;
        }
        const mapsApi = maps;
        const imported = typeof mapsApi.importLibrary === "function"
          ? await mapsApi.importLibrary("maps") as GoogleMapsLibrary
          : undefined;
        if (cancelled) return;
        const library = imported;
        const MapConstructor = typeof library?.Map === "function" ? library.Map : mapsApi.Map;
        const BoundsConstructor = typeof library?.LatLngBounds === "function" ? library.LatLngBounds : mapsApi.LatLngBounds;
        const PolygonConstructor = typeof library?.Polygon === "function" ? library.Polygon : mapsApi.Polygon;
        if (typeof MapConstructor !== "function" || typeof BoundsConstructor !== "function" || typeof PolygonConstructor !== "function") {
          if (renderRetry < 3) setRenderRetry((value) => value + 1);
          else setMapError(true);
          return;
        }
        const container = containerRef.current;
        if (!container) return;
        container.replaceChildren();
        const map = new MapConstructor(container, {
          center: { lat: 50.3569, lng: 7.589 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        const bounds = new BoundsConstructor();
        areaPaths.forEach((path) => {
          path.forEach((point) => bounds.extend(point));
          new PolygonConstructor({
            paths: path,
            strokeColor: "#176b36",
            strokeWeight: 2,
            strokeOpacity: 0.9,
            fillColor: "#176b36",
            fillOpacity: 0.14,
          }).setMap(map);
        });
        map.fitBounds?.(bounds);
      } catch {
        if (!cancelled) {
          if (renderRetry < 3) setRenderRetry((value) => value + 1);
          else setMapError(true);
        }
      }
    }
    void renderMap();
    return () => {
      cancelled = true;
    };
  }, [areaPaths, loaded, renderRetry]);

  if (!browserKey || areaPaths.length === 0) {
    return (
      <div className="mapFallback">
        <strong>{!browserKey ? "Gebietsansicht derzeit nicht verfügbar" : "Noch kein Verteilgebiet gespeichert"}</strong>
        <p>
          {!browserKey
            ? "Die interaktive Karte ist nicht aktiv. Das Gebiet bleibt als strukturierte Koordinatenvorschau gespeichert."
            : "Sobald ein Verteilgebiet gespeichert ist, wird es hier angezeigt."}
        </p>
      </div>
    );
  }

  if (!loaded || mapError) {
    return (
      <div className="mapFallback">
        <strong>{mapError ? "Gebietsansicht derzeit nicht verfügbar" : "Gebietsansicht wird geladen"}</strong>
        <p>{mapError ? "Die gespeicherten Gebietsdaten bleiben erhalten und können später erneut angezeigt werden." : "Die gespeicherten Gebietsdaten werden gerade dargestellt."}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="areaMap" style={{ minHeight: height }} />;
}
