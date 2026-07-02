"use client";

/* eslint-disable react-hooks/set-state-in-effect -- The order wizard intentionally restores a saved browser draft into controlled fields once on mount. */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { ReusableAreaOption } from "@/app/components/DistributionAreaEditor";

type LatLng = { lat: number; lng: number };

type Props = {
  areas: ReusableAreaOption[];
  today: string;
};

type Suggestion = {
  id: string;
  label: string;
  description: string;
  city: string;
  postalCode: string;
  street?: string | null;
  lat: number;
  lng: number;
  source: "local" | "google";
};

type Intelligence = {
  suggestions: ReusableAreaOption[];
  metrics: {
    households: number;
    flyerQuantity: number;
    routeDistanceMeters: number;
    routeDurationMinutes: number;
    coverageAreaSqm: number;
    grossPrice: string;
    netPrice: string;
    distributorNeed: number;
    score: number;
  };
  warehouse: { id: string; name: string; code: string; city: string; reason: string } | null;
  combinations: Array<{ key: string; orders: unknown[]; savedDistanceMeters: number; savedMinutes: number; savedCostEstimate: string }>;
};

type OrderDraft = {
  activeStep?: number;
  query?: string;
  selectedAreaId?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  houseNumber?: string;
  targetAreaName?: string;
  center?: LatLng;
  polygon?: LatLng[];
  flyerQuantity?: number;
  productFormat?: string;
  flyerSource?: string;
  targetGroup?: string;
  distributionType?: string;
  startDate?: string;
  endDate?: string;
  flexibleScheduling?: boolean;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
};

type GoogleLatLng = { lat: () => number; lng: () => number };
type GooglePath = {
  getLength: () => number;
  getAt: (index: number) => GoogleLatLng;
  forEach: (callback: (point: GoogleLatLng) => void) => void;
};
type GoogleMap = {
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: unknown) => void;
};
type GooglePolygon = {
  setMap: (map: GoogleMap | null) => void;
  setPath: (path: LatLng[]) => void;
  getPath: () => GooglePath;
};
type GoogleNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Polygon: new (options: Record<string, unknown>) => GooglePolygon;
    LatLngBounds: new () => { extend: (point: LatLng) => void };
    event: { addListener: (target: unknown, eventName: string, callback: () => void) => void };
  };
};

declare global {
  interface Window {
    google?: GoogleNamespace;
    __flyeroMapsLoading?: Promise<void>;
  }
}

const DEFAULT_CENTER = { lat: 50.3569, lng: 7.589 };
const DEFAULT_POLYGON: LatLng[] = [
  { lat: 50.3602, lng: 7.5852 },
  { lat: 50.3618, lng: 7.5934 },
  { lat: 50.3567, lng: 7.5988 },
  { lat: 50.3515, lng: 7.596 },
  { lat: 50.3502, lng: 7.5873 },
  { lat: 50.3548, lng: 7.5818 },
];

const ORDER_DRAFT_KEY = "flyero:customer:new-order-draft";

const productOptions = [
  { value: "DIN Lang (99 × 210 mm)", label: "DIN Lang (99 × 210 mm)" },
  { value: "A5 Flyer", label: "A5 Flyer" },
  { value: "A6 Flyer", label: "A6 Flyer" },
];

function OrderLogo() {
  return (
    <span className="flyeroLogo dark" aria-label="FLYERO">
      <span className="flyeroMark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>FLYERO</strong>
    </span>
  );
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(Math.round(value || 0));
}

function debounce<T extends (...args: never[]) => void>(callback: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

function polygonToGeoJson(points: LatLng[]) {
  const ring = points.map((point) => [point.lng, point.lat]);
  if (ring.length > 0) ring.push(ring[0]);
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
  };
}

function polygonAreaSqm(points: LatLng[]) {
  if (points.length < 3) return 0;
  const ring = [...points, points[0]];
  const metersLat = 111_320;
  const avgLat = ring.reduce((sum, point) => sum + point.lat, 0) / ring.length;
  const metersLng = Math.cos((avgLat * Math.PI) / 180) * metersLat;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const a = ring[index];
    const b = ring[index + 1];
    area += a.lng * metersLng * (b.lat * metersLat) - b.lng * metersLng * (a.lat * metersLat);
  }
  return Math.round(Math.abs(area / 2));
}

function featurePoints(geoJson: unknown) {
  const collection = geoJson as { features?: Array<{ geometry?: { coordinates?: number[][][] } }> } | null;
  const ring = collection?.features?.[0]?.geometry?.coordinates?.[0] ?? [];
  return ring
    .slice(0, -1)
    .map((point) => ({ lng: Number(point[0]), lat: Number(point[1]) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function polygonToSvg(points: LatLng[], center: LatLng) {
  const scale = 11_000;
  return points.map((point) => {
    const x = 50 + (point.lng - center.lng) * scale;
    const y = 50 - (point.lat - center.lat) * scale;
    return `${Math.max(5, Math.min(95, x))},${Math.max(5, Math.min(95, y))}`;
  }).join(" ");
}

function pathToPoints(path: GooglePath) {
  const points: LatLng[] = [];
  path.forEach((point) => points.push({ lat: point.lat(), lng: point.lng() }));
  return points;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMetersBetween(from: LatLng, to: LatLng) {
  const earthMeters = 6_371_000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function polygonPerimeterMeters(points: LatLng[]) {
  if (points.length < 3) return 0;
  const ring = [...points, points[0]];
  return ring.slice(1).reduce((sum, point, index) => sum + distanceMetersBetween(ring[index], point), 0);
}

function estimateHouseholdsFromArea(coverageAreaSqm: number) {
  return Math.max(1, Math.round(Math.max(coverageAreaSqm, 0) / 125));
}

function estimateWalkingDistanceMeters(coverageAreaSqm: number, perimeterMeters: number, households: number) {
  const deliveryPassMeters = Math.sqrt(Math.max(coverageAreaSqm, 0)) * 0.52;
  const stopBufferMeters = households * 1.35;
  return Math.max(350, Math.round(perimeterMeters * 1.14 + deliveryPassMeters + stopBufferMeters));
}

function estimateTeamDurationMinutes(distanceMeters: number, households: number, flyerQuantity: number) {
  const walkMinutes = Math.round(distanceMeters / 74);
  const deliveryMinutes = Math.round(households * 0.16);
  const teamSize = Math.max(1, Math.ceil(flyerQuantity / 3500));
  return Math.max(30, Math.round((walkMinutes + deliveryMinutes) / teamSize));
}

function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "wird berechnet";
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} h ${restMinutes} Min.` : `${hours} h`;
}

function loadGoogleMaps() {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!browserKey || typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (!window.__flyeroMapsLoading) {
    window.__flyeroMapsLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=3.64&libraries=geometry,places`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps konnte nicht geladen werden."));
      document.head.appendChild(script);
    });
  }
  return window.__flyeroMapsLoading.then(() => Boolean(window.google?.maps)).catch(() => false);
}

function MiniMapFallback({
  center,
  polygon,
  showHeatmap,
}: {
  center: LatLng;
  polygon: LatLng[];
  showHeatmap: boolean;
}) {
  const points = polygonToSvg(polygon, center);
  return (
    <div className="orderMapFallback" aria-label="Kartenfallback">
      <span className="mapDistrict districtOne">ALTSTADT</span>
      <span className="mapDistrict districtTwo">SÜDLICHE VORSTADT</span>
      <span className="mapDistrict districtThree">RHEIN</span>
      {showHeatmap ? <span className="mapHeat" /> : null}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="orderPolygonSvg">
        <polygon points={points} />
        <polyline points="46,38 52,46 58,52 63,58" />
        {polygon.map((point, index) => {
          const [x, y] = polygonToSvg([point], center).split(",").map(Number);
          return <circle key={`${point.lat}-${point.lng}-${index}`} cx={x} cy={y} r="2" />;
        })}
      </svg>
    </div>
  );
}

export function SmartOrderWizard({ areas, today }: Props) {
  const startedAtRef = useRef<number | null>(null);
  const draftRestoredRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const polygonRef = useRef<GooglePolygon | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mapsReady, setMapsReady] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [query, setQuery] = useState("Koblenz, Deutschland");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [city, setCity] = useState("Koblenz");
  const [postalCode, setPostalCode] = useState("56068");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [targetAreaName, setTargetAreaName] = useState("Koblenz Zentrum");
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [polygon, setPolygon] = useState<LatLng[]>(DEFAULT_POLYGON);
  const [, setHistory] = useState<LatLng[][]>([DEFAULT_POLYGON]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [flyerQuantity, setFlyerQuantity] = useState(10_000);
  const [productFormat, setProductFormat] = useState(productOptions[0].value);
  const [flyerSource, setFlyerSource] = useState("CUSTOMER_OWN");
  const [targetGroup, setTargetGroup] = useState("Alle Haushalte");
  const [distributionType, setDistributionType] = useState("Haushaltsverteilung");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [flexibleScheduling, setFlexibleScheduling] = useState(true);
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [mapMode, setMapMode] = useState<"map" | "satellite">("map");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [usedAutocomplete, setUsedAutocomplete] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [draftStatus, setDraftStatus] = useState("Entwurf wird vorbereitet");

  const coverageAreaSqm = useMemo(() => polygonAreaSqm(polygon), [polygon]);
  const perimeterMeters = useMemo(() => polygonPerimeterMeters(polygon), [polygon]);
  const localHouseholds = useMemo(() => estimateHouseholdsFromArea(coverageAreaSqm), [coverageAreaSqm]);
  const localRouteDistanceMeters = useMemo(
    () => estimateWalkingDistanceMeters(coverageAreaSqm, perimeterMeters, localHouseholds),
    [coverageAreaSqm, localHouseholds, perimeterMeters],
  );
  const localRouteDurationMinutes = useMemo(
    () => estimateTeamDurationMinutes(localRouteDistanceMeters, localHouseholds, flyerQuantity),
    [flyerQuantity, localHouseholds, localRouteDistanceMeters],
  );
  const households = intelligence?.metrics.households ?? localHouseholds;
  const routeDistanceMeters = intelligence?.metrics.routeDistanceMeters ?? localRouteDistanceMeters;
  const routeDurationMinutes = intelligence?.metrics.routeDurationMinutes ?? localRouteDurationMinutes;
  const grossPrice = intelligence?.metrics.grossPrice ?? "0";
  const distributorNeed = intelligence?.metrics.distributorNeed ?? Math.max(1, Math.ceil(flyerQuantity / 3500));
  const geoJson = useMemo(() => polygonToGeoJson(polygon), [polygon]);

  const smartAreas = useMemo(() => {
    const intelligenceAreas = intelligence?.suggestions?.length ? intelligence.suggestions : [];
    const needle = `${city} ${postalCode} ${query}`.toLowerCase();
    const local = areas.filter((area) => {
      const haystack = `${area.name} ${area.city ?? ""} ${area.postalCode ?? ""} ${area.district ?? ""}`.toLowerCase();
      return haystack.includes(city.toLowerCase()) || haystack.includes(postalCode.slice(0, 3)) || needle.includes((area.city ?? "").toLowerCase());
    });
    return [...intelligenceAreas, ...local].filter((area, index, list) => list.findIndex((item) => item.id === area.id) === index).slice(0, 4);
  }, [areas, city, intelligence, postalCode, query]);

  const pushPolygon = useCallback((next: LatLng[]) => {
    setPolygon(next);
    setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex((index) => index + 1);
  }, [historyIndex]);

  // Restore customer draft once from localStorage before the user continues editing.
  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(ORDER_DRAFT_KEY);
      if (!rawDraft) {
        draftRestoredRef.current = true;
        setDraftStatus("Entwurf wird automatisch gespeichert");
        return;
      }
      const draft = JSON.parse(rawDraft) as OrderDraft;
      if (draft.activeStep && draft.activeStep >= 1 && draft.activeStep <= 5) setActiveStep(draft.activeStep);
      if (draft.query) setQuery(draft.query);
      if (draft.selectedAreaId) setSelectedAreaId(draft.selectedAreaId);
      if (draft.city) setCity(draft.city);
      if (draft.postalCode) setPostalCode(draft.postalCode);
      if (draft.street) setStreet(draft.street);
      if (draft.houseNumber) setHouseNumber(draft.houseNumber);
      if (draft.targetAreaName) setTargetAreaName(draft.targetAreaName);
      if (draft.center && Number.isFinite(draft.center.lat) && Number.isFinite(draft.center.lng)) setCenter(draft.center);
      if (Array.isArray(draft.polygon) && draft.polygon.length >= 3) {
        setPolygon(draft.polygon);
        setHistory([draft.polygon]);
      }
      if (draft.flyerQuantity) setFlyerQuantity(draft.flyerQuantity);
      if (draft.productFormat) setProductFormat(draft.productFormat);
      if (draft.flyerSource) setFlyerSource(draft.flyerSource);
      if (draft.targetGroup) setTargetGroup(draft.targetGroup);
      if (draft.distributionType) setDistributionType(draft.distributionType);
      if (draft.startDate) setStartDate(draft.startDate);
      if (draft.endDate) setEndDate(draft.endDate);
      if (typeof draft.flexibleScheduling === "boolean") setFlexibleScheduling(draft.flexibleScheduling);
      if (draft.contactPerson) setContactPerson(draft.contactPerson);
      if (draft.contactPhone) setContactPhone(draft.contactPhone);
      if (draft.notes) setNotes(draft.notes);
      setDraftStatus("Entwurf geladen");
    } catch {
      window.localStorage.removeItem(ORDER_DRAFT_KEY);
      setDraftStatus("Entwurf wird automatisch gespeichert");
    } finally {
      draftRestoredRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftRestoredRef.current) return;
    const draft: OrderDraft = {
      activeStep,
      query,
      selectedAreaId,
      city,
      postalCode,
      street,
      houseNumber,
      targetAreaName,
      center,
      polygon,
      flyerQuantity,
      productFormat,
      flyerSource,
      targetGroup,
      distributionType,
      startDate,
      endDate,
      flexibleScheduling,
      contactPerson,
      contactPhone,
      notes,
    };
    window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
    setDraftStatus("Entwurf gespeichert");
  }, [
    activeStep,
    center,
    city,
    contactPerson,
    contactPhone,
    distributionType,
    endDate,
    flexibleScheduling,
    flyerQuantity,
    flyerSource,
    houseNumber,
    notes,
    polygon,
    postalCode,
    productFormat,
    query,
    selectedAreaId,
    startDate,
    street,
    targetAreaName,
    targetGroup,
  ]);

  const geocodeAddress = useCallback((input?: string) => {
    const params = new URLSearchParams({
      q: input ?? query,
      city,
      postalCode,
      street,
      houseNumber,
    });
    fetch(`/api/maps/geocode?${params.toString()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const result = payload?.data;
        if (!result) return;
        if (result.city) setCity(result.city);
        if (result.postalCode) setPostalCode(result.postalCode);
        if (result.street) setStreet(result.street);
        if (result.houseNumber) setHouseNumber(result.houseNumber);
        if (result.label) setQuery(result.label);
        const nextCenter = { lat: Number(result.lat), lng: Number(result.lng) };
        if (Number.isFinite(nextCenter.lat) && Number.isFinite(nextCenter.lng)) {
          setCenter(nextCenter);
          const nextPolygon = DEFAULT_POLYGON.map((point) => ({
            lat: point.lat + (nextCenter.lat - DEFAULT_CENTER.lat),
            lng: point.lng + (nextCenter.lng - DEFAULT_CENTER.lng),
          }));
          pushPolygon(nextPolygon);
        }
        setTargetAreaName(result.city ? `${result.postalCode ? `${result.postalCode} ` : ""}${result.city}` : "Verteilgebiet");
      })
      .catch(() => undefined);
  }, [city, houseNumber, postalCode, pushPolygon, query, street]);

  const fetchSuggestions = useMemo(() => debounce((value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/maps/autocomplete?q=${encodeURIComponent(value)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setSuggestions(payload?.data ?? []))
      .catch(() => setSuggestions([]));
  }, 220), []);

  useEffect(() => {
    fetchSuggestions(query);
  }, [fetchSuggestions, query]);

  useEffect(() => {
    const controller = new AbortController();
    setIntelligence(null);
    const params = new URLSearchParams({
      city,
      postalCode,
      street,
      houseNumber,
      flyerQuantity: String(flyerQuantity),
      households: String(localHouseholds),
      coverageAreaSqm: String(coverageAreaSqm),
      distanceMeters: String(localRouteDistanceMeters),
      perimeterMeters: String(perimeterMeters),
    });
    startTransition(() => {
      fetch(`/api/maps/order-intelligence?${params.toString()}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (payload?.data) setIntelligence(payload.data);
        })
        .catch(() => undefined);
    });
    return () => controller.abort();
  }, [city, postalCode, street, houseNumber, flyerQuantity, coverageAreaSqm, localHouseholds, localRouteDistanceMeters, perimeterMeters]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    navigator.sendBeacon?.("/api/maps/experience", JSON.stringify({
      eventType: "WIZARD_STARTED",
      city,
      postalCode,
      source: "order-wizard-reference-redesign",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadGoogleMaps().then((ready) => {
      if (isMounted) setMapsReady(ready);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapElementRef.current || !window.google?.maps) return;
    if (!mapRef.current) {
      mapRef.current = new window.google.maps.Map(mapElementRef.current, {
        center,
        zoom: 14,
        disableDefaultUI: true,
        mapTypeId: mapMode === "satellite" ? "satellite" : "roadmap",
        styles: mapMode === "map" ? [
          { elementType: "geometry", stylers: [{ color: "#182638" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#b8c7d9" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0a1018" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#26384d" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c213a" }] },
        ] : undefined,
      });
    }
    if (!polygonRef.current) {
      polygonRef.current = new window.google.maps.Polygon({
        paths: polygon,
        strokeColor: "#4a90ff",
        strokeOpacity: 1,
        strokeWeight: 3,
        fillColor: "#1f7aff",
        fillOpacity: 0.26,
        editable: true,
        draggable: true,
      });
      polygonRef.current.setMap(mapRef.current);
      const syncPath = () => {
        const next = pathToPoints(polygonRef.current?.getPath() ?? { getLength: () => 0, getAt: () => ({ lat: () => 0, lng: () => 0 }), forEach: () => undefined });
        if (next.length >= 3) setPolygon(next);
      };
      const path = polygonRef.current.getPath();
      window.google.maps.event.addListener(path, "set_at", syncPath);
      window.google.maps.event.addListener(path, "insert_at", syncPath);
      window.google.maps.event.addListener(polygonRef.current, "dragend", syncPath);
    }
  }, [center, mapMode, mapsReady, polygon]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !polygonRef.current || !window.google?.maps) return;
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(street ? 16 : 14);
    polygonRef.current.setPath(polygon);
    const bounds = new window.google.maps.LatLngBounds();
    polygon.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
  }, [center, mapsReady, polygon, street]);

  function applySuggestion(suggestion: Suggestion) {
    setUsedAutocomplete(true);
    setShowSuggestions(false);
    setQuery(suggestion.label);
    if (suggestion.city) setCity(suggestion.city);
    if (suggestion.postalCode) setPostalCode(suggestion.postalCode);
    if (suggestion.street) setStreet(suggestion.street);
    setTargetAreaName(suggestion.label.replace(/^\d+\s*/, ""));
    setSuggestions([]);
    if (suggestion.lat && suggestion.lng) {
      setCenter({ lat: suggestion.lat, lng: suggestion.lng });
    } else {
      geocodeAddress(suggestion.label);
    }
  }

  function openSuggestions() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setShowSuggestions(true);
  }

  function closeSuggestionsSoon() {
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
      if (query.trim()) geocodeAddress();
    }, 140);
  }

  function applyArea(area: ReusableAreaOption) {
    setSelectedAreaId(area.id);
    setTargetAreaName(area.name);
    if (area.city) setCity(area.city);
    if (area.postalCode) setPostalCode(area.postalCode);
    if (area.centerLat && area.centerLng) setCenter({ lat: area.centerLat, lng: area.centerLng });
    const nextPoints = featurePoints(area.geoJson);
    if (nextPoints.length >= 3) pushPolygon(nextPoints);
  }

  function moveQuantity(delta: number) {
    setFlyerQuantity((value) => Math.max(500, Math.min(250_000, value + delta)));
  }

  function trackSubmit() {
    window.localStorage.removeItem(ORDER_DRAFT_KEY);
    const durationMs = Date.now() - (startedAtRef.current ?? Date.now());
    void fetch("/api/maps/experience", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "ORDER_CREATED",
        city,
        postalCode,
        areaName: targetAreaName,
        areaType: "POLYGON",
        durationMs,
        clickCount,
        fieldCount: 9,
        usedAutocomplete,
        usedSavedArea: Boolean(selectedAreaId),
        polygonPoints: polygon.length,
        households,
        flyerQuantity,
        coverageAreaSqm,
        routeDistanceMeters,
        routeDurationMinutes,
        metadata: { mapMode, showHeatmap, productFormat, targetGroup, distributionType },
      }),
    });
  }

  const stepState = [
    { id: 1, title: "Gebiet festlegen", detail: "Wähle und zeichne das Verteilgebiet", value: `${(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²` },
    { id: 2, title: "Flyer & Stückzahl", detail: "Wähle dein Produkt und die Menge", value: `${formatNumber(flyerQuantity)} Stück` },
    { id: 3, title: "Verteilung & Zielgruppe", detail: "Lege Verteilart und Zielgruppe fest", value: distributionType },
    { id: 4, title: "Zeitraum & Auslieferung", detail: "Bestimme Zeitraum und Auslieferung", value: startDate },
    { id: 5, title: "Zusammenfassung", detail: "Prüfe deine Angaben und bestätige", value: formatCurrency(grossPrice) },
  ];

  function renderStepContent(stepId: number) {
    if (stepId === 1) {
      return (
        <section className="orderPanelBlock primary inlineStepBlock">
          <label>
            PLZ, Ort oder Adresse
            <div className="searchInputShell">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    setShowSuggestions(false);
                    geocodeAddress();
                  }
                }}
                onFocus={openSuggestions}
                onBlur={closeSuggestionsSoon}
                placeholder="z. B. 56068 Koblenz"
                autoComplete="off"
              />
              <button type="button" onClick={() => geocodeAddress()}>⌕</button>
            </div>
          </label>
          <div className="selectedLocationBar">
            <strong>{postalCode} {city}</strong>
            <span>{street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : "Gebiet wird direkt auf der Karte aktualisiert"}</span>
          </div>
          {showSuggestions && suggestions.length > 0 ? (
            <div className="orderSuggestions">
              {suggestions.map((suggestion) => (
                <button type="button" key={suggestion.id} onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion(suggestion)}>
                  <strong>{suggestion.label}</strong>
                  <span>{suggestion.description}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="modeTabs">
            <button type="button" className="selected">Gebiet zeichnen</button>
            <button type="button" onClick={() => setActiveStep(3)}>POI verwenden</button>
          </div>
          <div className="savedAreaMini">
            <div>
              <span>Gewähltes Gebiet</span>
              <strong>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</strong>
            </div>
            <div className="miniPolygon" aria-hidden="true" />
          </div>
        </section>
      );
    }

    if (stepId === 2) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <label>
            Flyerformat
            <select value={productFormat} onChange={(event) => setProductFormat(event.target.value)}>
              {productOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="quantityControl">
            <button type="button" onClick={() => moveQuantity(-1000)}>−</button>
            <input value={flyerQuantity} onChange={(event) => setFlyerQuantity(Number(event.target.value) || 0)} inputMode="numeric" />
            <button type="button" onClick={() => moveQuantity(1000)}>＋</button>
            <span>Stück</span>
          </div>
        </section>
      );
    }

    if (stepId === 3) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <label className="selectLine">
            <span>Verteilart</span>
            <select value={distributionType} onChange={(event) => setDistributionType(event.target.value)}>
              <option>Haushaltsverteilung</option>
              <option>Gewerbegebiet</option>
              <option>Eventgebiet</option>
            </select>
          </label>
          <label className="selectLine">
            <span>Zielgruppe</span>
            <select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}>
              <option>Alle Haushalte</option>
              <option>Familienhaushalte</option>
              <option>Innenstadt & Laufkundschaft</option>
              <option>Lokale Gewerbe</option>
            </select>
          </label>
          {smartAreas.length > 0 ? (
            <div className="areaQuickList">
              {smartAreas.map((area) => (
                <button type="button" key={area.id} className={selectedAreaId === area.id ? "selected" : ""} onClick={() => applyArea(area)}>
                  {area.name}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

    if (stepId === 4) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <div className="dateGrid">
            <label>Start<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>Ende<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
          <label className="checkLine">
            <input type="checkbox" checked={flexibleScheduling} onChange={(event) => setFlexibleScheduling(event.target.checked)} />
            Express oder flexible Planung möglich
          </label>
        </section>
      );
    }

    return (
      <section className="orderPanelBlock inlineStepBlock">
        <div className="summaryMiniGrid">
          <span><strong>{postalCode} {city}</strong>Gebiet</span>
          <span><strong>{formatNumber(flyerQuantity)}</strong>Flyer</span>
          <span><strong>{formatCurrency(grossPrice)}</strong>Preis</span>
        </div>
        <details className="orderDetails inlineDetails">
          <summary>Kontakt & Hinweise</summary>
          <label>Kontaktperson<input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} /></label>
          <label>Telefon<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
          <label>Hinweise<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="modeTabs">
            <button type="button" className={flyerSource === "CUSTOMER_OWN" ? "selected" : ""} onClick={() => setFlyerSource("CUSTOMER_OWN")}>Flyer vorhanden</button>
            <button type="button" className={flyerSource === "PRINT_SERVICE" ? "selected" : ""} onClick={() => setFlyerSource("PRINT_SERVICE")}>Druck benötigt</button>
          </div>
        </details>
      </section>
    );
  }

  return (
    <form
      action="/api/customer/orders"
      method="post"
      className="orderExperience"
      onClick={() => setClickCount((value) => value + 1)}
      onSubmit={trackSubmit}
    >
      <input type="hidden" name="serviceType" value="FLYER_DISTRIBUTION" />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="postalCode" value={postalCode} />
      <input type="hidden" name="street" value={street} />
      <input type="hidden" name="houseNumber" value={houseNumber} />
      <input type="hidden" name="targetAreaName" value={targetAreaName} />
      <input type="hidden" name="areaType" value="POLYGON" />
      <input type="hidden" name="distributionAreaId" value={selectedAreaId} />
      <input type="hidden" name="targetAreaGeoJson" value={JSON.stringify(geoJson)} />
      <input type="hidden" name="coverageAreaSqm" value={coverageAreaSqm} />
      <input type="hidden" name="estimatedHouseholds" value={households} />
      <input type="hidden" name="estimatedFlyers" value={flyerQuantity} />
      <input type="hidden" name="estimatedDistanceMeters" value={routeDistanceMeters} />
      <input type="hidden" name="centerLat" value={center.lat} />
      <input type="hidden" name="centerLng" value={center.lng} />
      <input type="hidden" name="flyerQuantity" value={flyerQuantity} />
      <input type="hidden" name="flyerSource" value={flyerSource} />
      <input type="hidden" name="preferredStartDate" value={startDate} />
      <input type="hidden" name="preferredEndDate" value={endDate} />
      <input type="hidden" name="flexibleScheduling" value={flexibleScheduling ? "true" : "false"} />
      <input type="hidden" name="contactPerson" value={contactPerson} />
      <input type="hidden" name="contactPhone" value={contactPhone} />
      <input type="hidden" name="notes" value={`${notes}${notes ? "\n" : ""}Produkt: ${productFormat}. Zielgruppe: ${targetGroup}.`} />

      <aside className="orderSideNav" aria-label="Bestellnavigation">
        <OrderLogo />
        <Link href="/customer/orders/new" className="sideNavActive"><span>+</span>Neue Bestellung</Link>
        <Link href="/customer/dashboard"><span>D</span>Dashboard</Link>
        <Link href="/customer/orders"><span>B</span>Bestellungen</Link>
        <Link href="/customer/documents"><span>F</span>Dokumente</Link>
        <Link href="/customer/payments"><span>EUR</span>Zahlungen</Link>
        <Link href="/customer/invoices"><span>R</span>Rechnungen</Link>
        <Link href="/customer/reports"><span>P</span>Berichte</Link>
        <Link href="/customer/notifications"><span>!</span>Nachrichten</Link>
        <Link href="/customer/support"><span>?</span>Support</Link>
        <Link href="/customer/profile"><span>*</span>Einstellungen</Link>
        <div className="sideNavFooter">
          <button type="submit" formAction="/api/auth/logout">Ausloggen</button>
        </div>
      </aside>

      <aside className="orderStepPanel">
        <div className="draftBadge">{draftStatus}</div>
        <div className="orderStepper">
          {stepState.map((step) => (
            <article key={step.id} className={activeStep === step.id ? "active" : ""}>
              <button
                type="button"
                className={activeStep === step.id ? "active" : ""}
                onClick={() => setActiveStep(step.id)}
              >
                <span>{step.id}</span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
                <em>{step.value}</em>
              </button>
              {activeStep === step.id ? renderStepContent(step.id) : null}
            </article>
          ))}
        </div>

        <div className="orderPriceFooter">
          <span>Geschätzter Preis (brutto)</span>
          <strong>{Number(grossPrice) > 0 ? formatCurrency(grossPrice) : "wird berechnet"}</strong>
          <button type="submit">Weiter zur Übersicht<span aria-hidden="true">→</span></button>
        </div>
      </aside>

      <section className={`orderMapStage ${mapMode} ${showHeatmap ? "heatmap" : ""}`}>
        <div className="mapChromeTop">
          <span>{postalCode} {city}</span>
          <span>18°C</span>
        </div>
        <div className="mapTabs">
          <button type="button" className={mapMode === "map" ? "selected" : ""} onClick={() => setMapMode("map")}>Karte</button>
          <button type="button" className={mapMode === "satellite" ? "selected" : ""} onClick={() => setMapMode("satellite")}>Satellit</button>
          <button type="button" className={showHeatmap ? "selected" : ""} onClick={() => setShowHeatmap((value) => !value)}>Heatmap</button>
        </div>
        <div ref={mapElementRef} className="orderGoogleMap" aria-hidden={!mapsReady} />
        {!mapsReady ? <MiniMapFallback center={center} polygon={polygon} showHeatmap={showHeatmap} /> : null}
        <div className="mapZoomRail" aria-label="Kartensteuerung">
          <button type="button" onClick={() => geocodeAddress()}>⌖</button>
          <button type="button" onClick={() => mapRef.current?.setZoom(15)}>＋</button>
          <button type="button" onClick={() => mapRef.current?.setZoom(13)}>−</button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
        </div>
        <aside className="areaOverview">
          <div className="overviewHead">
            <h2>Gebietsübersicht</h2>
            <span>{isPending ? "Wird aktualisiert" : "Live"}</span>
          </div>
          <dl>
            <div><dt>Haushalte</dt><dd>{formatNumber(households)}</dd></div>
            <div><dt>Fläche</dt><dd>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</dd></div>
            <div><dt>Flyer</dt><dd>{formatNumber(flyerQuantity)} Stück</dd></div>
            <div><dt>Geschätzter Preis</dt><dd>{formatCurrency(grossPrice)}</dd></div>
            <div><dt>ca. Laufstrecke</dt><dd>{(routeDistanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km</dd></div>
            <div><dt>Geschätzte Zustelldauer</dt><dd>{formatDuration(routeDurationMinutes)}</dd></div>
            <div><dt>Lager</dt><dd>{intelligence?.warehouse?.city ?? "automatisch"}</dd></div>
            <div><dt>Verteiler benötigt</dt><dd>{distributorNeed}</dd></div>
          </dl>
          <p className="availabilityGood">Sehr gute Verteilbarkeit</p>
        </aside>
      </section>
    </form>
  );
}
