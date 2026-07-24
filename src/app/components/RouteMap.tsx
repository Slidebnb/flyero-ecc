"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RoutePoint = {
  lat: number;
  lng: number;
  recordedAt?: string;
};

type PhotoPoint = {
  lat?: number | null;
  lng?: number | null;
  label?: string;
};

type Props = {
  points: RoutePoint[];
  photos?: PhotoPoint[];
  targetArea?: Array<{ lat: number; lng: number }> | null;
  height?: number;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps: {
      Map: new (el: HTMLElement, options: Record<string, unknown>) => unknown;
      LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
      Polyline: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void };
      Marker: new (options: Record<string, unknown>) => void;
      Polygon: new (options: Record<string, unknown>) => { setMap: (map: unknown) => void };
    };
  };
};

const GOOGLE_MAPS_VERSION = "3.64";

export function RouteMap({ points, photos = [], targetArea = null, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  const validPoints = useMemo(() => points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)), [points]);
  const validPhotos = photos.filter((photo) => Number.isFinite(photo.lat) && Number.isFinite(photo.lng));

  useEffect(() => {
    if (!browserKey || validPoints.length === 0) return;
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
  }, [browserKey, validPoints.length]);

  useEffect(() => {
    if (!loaded || !containerRef.current || validPoints.length === 0) return;
    const maps = (window as GoogleMapsWindow).google?.maps;
    if (!maps) return;
    const map = new maps.Map(containerRef.current, {
      center: validPoints[0],
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
    const bounds = new maps.LatLngBounds();
    validPoints.forEach((point) => bounds.extend(point));
    new maps.Polyline({
      path: validPoints,
      strokeColor: "#102033",
      strokeWeight: 4,
      strokeOpacity: 0.9,
    }).setMap(map);
    new maps.Marker({ position: validPoints[0], map, label: "S", title: "Start" });
    new maps.Marker({ position: validPoints[validPoints.length - 1], map, label: "E", title: "Ende" });
    validPhotos.forEach((photo, index) => {
      const position = { lat: Number(photo.lat), lng: Number(photo.lng) };
      bounds.extend(position);
      new maps.Marker({ position, map, label: String(index + 1), title: photo.label ?? "Foto" });
    });
    if (targetArea?.length) {
      targetArea.forEach((point) => bounds.extend(point));
      new maps.Polygon({
        paths: targetArea,
        strokeColor: "#176b36",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#176b36",
        fillOpacity: 0.1,
      }).setMap(map);
    }
    (map as { fitBounds?: (bounds: unknown) => void }).fitBounds?.(bounds);
  }, [loaded, targetArea, validPhotos, validPoints]);

  if (!browserKey || validPoints.length === 0) {
    return (
      <div className="mapFallback">
        <strong>{!browserKey ? "Kartenansicht derzeit nicht verfügbar" : "Noch keine GPS-Punkte vorhanden"}</strong>
        <p>
          {!browserKey
            ? "Die interaktive Karte ist nicht aktiv. Die Route bleibt als Koordinatenliste verfügbar."
            : "Sobald der Verteiler GPS-Punkte hochlädt, erscheint hier der Tourverlauf."}
        </p>
        <ol>
          {validPoints.map((point, index) => (
            <li key={`${point.lat}-${point.lng}-${index}`}>
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)} {point.recordedAt ? `- ${point.recordedAt}` : ""}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return <div ref={containerRef} className="routeMap" style={{ minHeight: height }} />;
}
