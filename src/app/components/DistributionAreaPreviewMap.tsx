"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  geoJson?: unknown;
  height?: number;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (el: HTMLElement, options: Record<string, unknown>) => GoogleMap;
      LatLngBounds: new () => GoogleBounds;
      Polygon: new (options: Record<string, unknown>) => { setMap: (map: GoogleMap) => void };
    };
  };
};

type GoogleMap = {
  fitBounds?: (bounds: GoogleBounds) => void;
};

type GoogleBounds = {
  extend: (position: { lat: number; lng: number }) => void;
};

const GOOGLE_MAPS_VERSION = "3.64";

function features(value: unknown) {
  const candidate = value as { type?: string; features?: unknown[] };
  return candidate?.type === "FeatureCollection" && Array.isArray(candidate.features)
    ? candidate.features
    : [];
}

function pathFromFeature(feature: unknown) {
  const candidate = feature as { geometry?: { type?: string; coordinates?: number[][][] } };
  if (candidate.geometry?.type !== "Polygon") return [];
  return (candidate.geometry.coordinates?.[0] ?? [])
    .map((point) => ({ lat: Number(point[1]), lng: Number(point[0]) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

export function DistributionAreaPreviewMap({ geoJson, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const areaFeatures = features(geoJson);

  useEffect(() => {
    if (!browserKey || areaFeatures.length === 0) return;
    const win = window as GoogleMapsWindow;
    if (win.google?.maps) {
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=${GOOGLE_MAPS_VERSION}&loading=async`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [areaFeatures.length, browserKey]);

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
    const bounds = new maps.LatLngBounds();
    areaFeatures.forEach((feature) => {
      const path = pathFromFeature(feature);
      path.forEach((point) => bounds.extend(point));
      if (path.length >= 3) {
        new maps.Polygon({
          paths: path,
          strokeColor: "#176b36",
          strokeWeight: 2,
          strokeOpacity: 0.9,
          fillColor: "#176b36",
          fillOpacity: 0.14,
        }).setMap(map);
      }
    });
    map.fitBounds?.(bounds);
  }, [areaFeatures, loaded]);

  if (!browserKey || areaFeatures.length === 0) {
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

  return <div ref={containerRef} className="areaMap" style={{ minHeight: height }} />;
}
