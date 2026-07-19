"use client";

/* eslint-disable react-hooks/set-state-in-effect -- The order wizard intentionally restores drafts, map state, and server-derived warehouse state from external systems. */

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { hasExplicitPublicLocationContext, isGermanPostalCode, type PublicLocationContext } from "@/lib/publicLocationContext";
import {
  CircleHelp,
  FileStack,
  FileText,
  Mail,
  LocateFixed,
  LayoutDashboard,
  ListChecks,
  Maximize2,
  Plus,
  ReceiptText,
} from "lucide-react";
import type { ReusableAreaOption } from "@/app/components/DistributionAreaEditor";
import { normalizeOnlineServiceType, normalizeServiceProductFormat, serviceCatalogItem, type OnlineServiceType } from "@/lib/serviceCatalog";
import { MINIMUM_FLYER_QUANTITY } from "@/lib/constants";
import type {
  CustomerWarehouse,
  LatLng,
  LocationResult,
  OrderAreaSegmentDraft,
  OrderDraft,
  OverviewDragState,
  PolygonSource,
  Suggestion,
  WizardProps,
} from "./orderWizardTypes";
import { OrderAreaStep } from "./OrderAreaStep";
import { OrderFinishStep } from "./OrderFinishStep";
import { OrderMaterialStep } from "./OrderMaterialStep";
import { OrderScheduleStep } from "./OrderScheduleStep";
import { OrderSummaryStep } from "./OrderSummaryStep";
import { useOrderIntelligence } from "./hooks/useOrderIntelligence";
import { useOrderLocationSearch } from "./hooks/useOrderLocationSearch";
import { useOrderDraft } from "./hooks/useOrderDraft";
import { useOrderSubmission } from "./hooks/useOrderSubmission";
import { useOrderMap } from "./hooks/useOrderMap";

const orderNavItems = [
  { href: "/customer/dashboard", label: "Übersicht", icon: LayoutDashboard, group: "Start" },
  { href: "/customer/orders/new", label: "Neue Verteilung", icon: Plus, group: "Start", active: true },
  { href: "/customer/orders", label: "Kampagnen", icon: ListChecks, group: "Start" },
  { href: "/customer/reports", label: "Nachweise", icon: FileText, group: "Ergebnisse" },
  { href: "/customer/invoices", label: "Rechnungen", icon: ReceiptText, group: "Ergebnisse" },
  { href: "/customer/documents", label: "Dateien", icon: FileStack, group: "Ergebnisse" },
  { href: "/customer/support", label: "Hilfe", icon: CircleHelp, group: "Hilfe" },
];

const publicPlannerNavItems = [
  { href: "/", label: "FLYERO Start", icon: LayoutDashboard, group: "FLYERO" },
  { href: "/preise", label: "Preise", icon: ReceiptText, group: "FLYERO" },
  { href: "/verteilung-anfragen", label: "Anfrage senden", icon: Mail, group: "FLYERO" },
  { href: "/login?next=%2Fcustomer%2Forders%2Fnew", label: "Einloggen", icon: CircleHelp, group: "Konto" },
];

type GoogleLatLng = { lat: () => number; lng: () => number };
type GooglePath = {
  getLength: () => number;
  getAt: (index: number) => GoogleLatLng;
  forEach: (callback: (point: GoogleLatLng) => void) => void;
  addListener?: (eventName: string, callback: () => void) => GoogleEventListener | void;
};
type GoogleEventListener = { remove?: () => void };
type GoogleMapMouseEvent = { latLng?: GoogleLatLng };
type GoogleMap = {
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
  fitBounds: (bounds: unknown) => void;
  setMapTypeId: (mapTypeId: "roadmap" | "satellite") => void;
  getFeatureLayer?: (featureType: string) => GoogleFeatureLayer;
};
type GoogleFeature = { placeId?: string };
type GoogleFeatureMouseEvent = { features?: GoogleFeature[] };
type GoogleFeatureLayer = {
  isAvailable?: boolean;
  style: unknown;
  addListener?: (eventName: string, callback: (event: GoogleFeatureMouseEvent) => void) => GoogleEventListener | void;
};
type GooglePolygon = {
  setMap: (map: GoogleMap | null) => void;
  setPath: (path: LatLng[]) => void;
  getPath: () => GooglePath;
  addListener?: (eventName: string, callback: () => void) => GoogleEventListener | void;
};
type GoogleNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Polygon: new (options: Record<string, unknown>) => GooglePolygon;
    LatLngBounds: new () => { extend: (point: LatLng) => void };
    event: { addListener: (target: unknown, eventName: string, callback: (event?: GoogleMapMouseEvent) => void) => GoogleEventListener | void };
    FeatureType?: { POSTAL_CODE?: string; LOCALITY?: string };
  };
};

declare global {
  interface Window {
    google?: GoogleNamespace;
    __flyeroMapsLoading?: Promise<void>;
  }
}

const PUBLIC_DEFAULT_CENTER: LatLng = { lat: 51.1657, lng: 10.4515 };

const ORDER_DRAFT_KEY = "flyero:order-planner:draft:v2";
const PUBLIC_ORDER_DRAFT_KEY = "flyero:order-planner:public-draft:v3";
const LEGACY_ORDER_DRAFT_KEY = "flyero:customer:new-order-draft";
const MAXIMUM_FLYER_QUANTITY = 250_000;

const inquiryFormHref = "/downloads/flyero-anfrageformular.pdf";
const inquiryMailHref = "mailto:hallo@flyero.org?subject=Flyerverteilung%20anfragen&body=Hallo%20FLYERO%2C%0A%0Aich%20m%C3%B6chte%20eine%20Flyerverteilung%20anfragen.%0A%0AFirma%3A%0AAnsprechpartner%3A%0ATelefon%3A%0AE-Mail%3A%0AVerteilgebiet%2FPLZ%2FOrt%3A%0AFlyeranzahl%3A%0AWunschzeitraum%3A%0ABemerkungen%3A";

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

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampIsoDate(value: string | undefined, minimum: string) {
  return value && value >= minimum ? value : minimum;
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(date)
    : "offen";
}

function trackPublicPlannerEvent(endpoint: string, eventType: string, data: Record<string, unknown> = {}) {
  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventType, ...data }),
    keepalive: true,
  }).catch(() => undefined);
}

function polygonToGeoJson(points: LatLng[]) {
  const ring = points.map((point) => [point.lng, point.lat]);
  if (ring.length > 0) ring.push(ring[0]);
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }],
  };
}

function segmentsToGeoJson(segments: Array<{ points: LatLng[]; name: string; city: string; postalCode: string }>) {
  return {
    type: "FeatureCollection",
    features: segments
      .filter((segment) => segment.points.length >= 3)
      .map((segment) => {
        const geometry = polygonToGeoJson(segment.points).features[0].geometry;
        return {
          type: "Feature",
          properties: { name: segment.name, city: segment.city, postalCode: segment.postalCode },
          geometry,
        };
      }),
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

function normalizeLocationPart(value?: string | null) {
  return (value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function areaCenter(area: ReusableAreaOption, fallback: LatLng) {
  return area.centerLat && area.centerLng ? { lat: area.centerLat, lng: area.centerLng } : fallback;
}

function confidenceLabel(confidence?: "high" | "medium" | "low", hasArea = true) {
  if (!hasArea) return "Gebiet auf der Karte auswählen";
  if (confidence === "high") return "Gebietsdaten geprüft";
  if (confidence === "medium") return "Gebiet aus verfügbaren Daten berechnet";
  return "Gebietsdaten werden geprüft";
}

function syncStateLabel(status: "local" | "updating" | "live" | "error", confidence?: "high" | "medium" | "low", pending?: boolean, hasArea = true) {
  if (!hasArea) return "Gebiet auswählen";
  if (status === "updating" || pending) return "Wird aktualisiert";
  if (status === "live" && confidence === "high") return "Gebiet geprüft";
  if (status === "live") return "Gebiet berechnet";
  if (status === "error") return "Prüfung erforderlich";
  return "Berechnung vorbereitet";
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

function clampOverviewOffset(x: number, y: number) {
  return {
    x: Math.max(-560, Math.min(80, x)),
    y: Math.max(-360, Math.min(120, y)),
  };
}

function deliverabilityLabel(score?: number | null, hasArea = true) {
  if (!hasArea) return "Gebiet auswählen";
  if (!Number.isFinite(score ?? NaN)) return "Gebiet wird noch geprüft";
  if ((score ?? 0) >= 82) return "Sehr gut erreichbar";
  if ((score ?? 0) >= 65) return "Gut erreichbar";
  if ((score ?? 0) >= 45) return "Wir prüfen die Erreichbarkeit";
  return "Gebiet wird vorab geprüft";
}

function boundaryLayerStyle(selectedPlaceIds: string[]) {
  return (options: { feature?: GoogleFeature }) => {
    const placeId = options.feature?.placeId ?? "";
    const selected = selectedPlaceIds.includes(placeId);
    return {
      strokeColor: selected ? "#a7ff00" : "#87a4c2",
      strokeOpacity: selected ? 1 : 0.85,
      strokeWeight: selected ? 3 : 1,
      fillColor: selected ? "#a7ff00" : "#52708f",
      fillOpacity: selected ? 0.28 : 0.1,
    };
  };
}

function loadGoogleMaps() {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!browserKey || typeof window === "undefined") return Promise.resolve(false);
  const isReady = () => Boolean(
    window.google?.maps?.Map
      && window.google.maps.Polygon
      && window.google.maps.LatLngBounds,
  );
  if (isReady()) return Promise.resolve(true);
  if (!window.__flyeroMapsLoading) {
    window.__flyeroMapsLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=3.64&loading=async&libraries=places`;
      script.async = true;
      script.onload = () => {
        const startedAt = Date.now();
        const waitForLibraries = () => {
          if (isReady()) {
            resolve();
            return;
          }
          if (Date.now() - startedAt >= 10000) {
            reject(new Error("Google Maps Zusatzbibliotheken konnten nicht geladen werden."));
            return;
          }
          window.setTimeout(waitForLibraries, 50);
        };
        waitForLibraries();
      };
      script.onerror = () => reject(new Error("Google Maps konnte nicht geladen werden."));
      document.head.appendChild(script);
    });
  }
  return window.__flyeroMapsLoading.then(() => isReady()).catch(() => false);
}

function MiniMapFallback() {
  return (
    <div className="orderMapFallback" role="status" aria-label="Karte gerade nicht verfügbar">
      <strong>Karte gerade nicht verfügbar</strong>
      <span>Dein Gebiet bleibt erhalten. Du kannst die Anfrage trotzdem vorbereiten.</span>
    </div>
  );
}

export function SmartOrderWizard({ areas, today, mode = "authenticated_order", initialLocation: initialLocationProp = null }: WizardProps) {
  const isPublicPlanner = mode === "public_quote";
  const minimumStartDate = useMemo(() => addDaysToIsoDate(today, 7), [today]);
  const draftStorageKey = isPublicPlanner ? PUBLIC_ORDER_DRAFT_KEY : ORDER_DRAFT_KEY;
  const mapsApiPrefix = isPublicPlanner ? "/api/public/planner" : "/api/maps";
  const autocompleteEndpoint = isPublicPlanner ? `${mapsApiPrefix}/autocomplete` : "/api/maps/autocomplete";
  const geocodeEndpoint = isPublicPlanner ? `${mapsApiPrefix}/geocode` : "/api/maps/geocode";
  const intelligenceEndpoint = isPublicPlanner ? `${mapsApiPrefix}/quote` : "/api/maps/order-intelligence";
  const experienceEndpoint = isPublicPlanner ? "/api/public/planner/experience" : "/api/maps/experience";
  const startedAtRef = useRef<number | null>(null);
  const draftRestoredRef = useRef(false);
  const repeatLoadedRef = useRef(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationAbortRef = useRef<AbortController | null>(null);
  const locationRequestSequenceRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const polygonRef = useRef<GooglePolygon | null>(null);
  const polygonStateRef = useRef<LatLng[]>([]);
  const polygonListenerHandlesRef = useRef<GoogleEventListener[]>([]);
  const drawingClickListenerRef = useRef<GoogleEventListener | null>(null);
  const drawingPreviewRef = useRef<GooglePolygon | null>(null);
  const drawingPointsRef = useRef<LatLng[]>([]);
  const finishDrawingRef = useRef<() => void>(() => undefined);
  const areaSelectionModeRef = useRef<"boundary" | "draw">("draw");
  const segmentPolygonsRef = useRef(new Map<string, GooglePolygon>());
  const boundaryLayerRefs = useRef(new Map<string, GoogleFeatureLayer>());
  const boundaryLayerListenersRef = useRef<GoogleEventListener[]>([]);
  const boundaryIdleListenerRef = useRef<GoogleEventListener | null>(null);
  const selectedBoundaryPlaceIdsRef = useRef<string[]>([]);
  const areaSegmentsRef = useRef<OrderAreaSegmentDraft[]>([]);
  const selectBoundaryAreaRef = useRef<(placeId: string) => void>(() => undefined);
  const applyLocationResultRef = useRef<(result: LocationResult, options?: { forceReplace?: boolean }) => void>(() => undefined);
  const overviewDragRef = useRef<OverviewDragState | null>(null);
  const initialSearchRef = useRef<PublicLocationContext | null>(null);
  const trackedPublicStepsRef = useRef(new Set<number>());
  const { mapsReady, mapsLoadStatus } = useOrderMap({ loadGoogleMaps });
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<PublicLocationContext | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [targetAreaName, setTargetAreaName] = useState("");
  const [center, setCenter] = useState<LatLng>(PUBLIC_DEFAULT_CENTER);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [polygonSource, setPolygonSource] = useState<PolygonSource>("postal_code");
  const [drawingPoints, setDrawingPoints] = useState<LatLng[]>([]);
  const [areaSegments, setAreaSegments] = useState<OrderAreaSegmentDraft[]>([]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<LocationResult | null>(null);
  const [, setHistory] = useState<LatLng[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [flyerQuantity, setFlyerQuantity] = useState(MINIMUM_FLYER_QUANTITY);
  const [serviceType, setServiceType] = useState<OnlineServiceType>("FLYER_STANDARD");
  const [productFormat, setProductFormat] = useState(() => serviceCatalogItem("FLYER_STANDARD").formatOptions[0]);
  const [weightInGrams, setWeightInGrams] = useState("");
  const [samplingDetails, setSamplingDetails] = useState({ size: "", packaging: "", fragile: false, personalHandover: false, storage: "" });
  const [warehouseOptions, setWarehouseOptions] = useState<CustomerWarehouse[]>([]);
  const [warehouseOptionsStatus, setWarehouseOptionsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [flyerQuantityTouched, setFlyerQuantityTouched] = useState(false);
  const selectedService = serviceCatalogItem(serviceType);
  const numericWeightInGrams = weightInGrams ? Number(weightInGrams) : undefined;
  const effectiveWeightClass = numericWeightInGrams === undefined
    ? "LIGHT"
    : numericWeightInGrams <= 20 ? "LIGHT" : numericWeightInGrams <= 50 ? "STANDARD" : numericWeightInGrams <= 100 ? "MEDIUM" : numericWeightInGrams <= 250 ? "HEAVY" : "CUSTOM";
  const productDetails = serviceType === "PRODUCT_SAMPLING" ? samplingDetails : undefined;
  const [flyerSource, setFlyerSource] = useState("CUSTOMER_OWN");
  const [printDataStatus, setPrintDataStatus] = useState("UPLOAD_LATER");
  const [targetGroup, setTargetGroup] = useState("Alle Haushalte");
  const [distributionType, setDistributionType] = useState("Haushaltsverteilung");
  const [startDate, setStartDate] = useState(() => addDaysToIsoDate(today, 7));
  const [endDate, setEndDate] = useState(() => addDaysToIsoDate(today, 7));
  const [flexibleScheduling, setFlexibleScheduling] = useState(true);
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [mapMode, setMapMode] = useState<"map" | "satellite">("map");
  // Drawing is the universal path. Boundary selection is an optional Google
  // vector-map enhancement and must never block a customer without a Map ID.
  const [areaSelectionMode, setAreaSelectionMode] = useState<"boundary" | "draw">("draw");
  const [boundaryLayerStatus, setBoundaryLayerStatus] = useState<"unknown" | "available" | "unavailable">("unknown");
  const [selectedBoundaryPlaceIds, setSelectedBoundaryPlaceIds] = useState<string[]>([]);
  const [mapNotice, setMapNotice] = useState("");
  const [usedAutocomplete, setUsedAutocomplete] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const { suggestions, clearSuggestions } = useOrderLocationSearch({ autocompleteEndpoint, query });

  useEffect(() => {
    polygonStateRef.current = polygon;
  }, [polygon]);
  const [draftStatus, setDraftStatus] = useState("Entwurf wird vorbereitet");
  const [finishStatus, setFinishStatus] = useState("");
  const [repeatPrintChoice, setRepeatPrintChoice] = useState<"pending" | "same" | "changed" | null>(null);
  const [overviewOffset, setOverviewOffset] = useState({ x: 0, y: 0 });
  const { isSubmitting, beginSubmission, endSubmission } = useOrderSubmission();
  const mapsBrowserKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  const mapsBoundaryMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";
  const mapsBoundaryConfigured = Boolean(mapsBoundaryMapId);

  useEffect(() => {
    if (!mapsBoundaryConfigured) {
      setBoundaryLayerStatus("unavailable");
      setAreaSelectionMode("draw");
    }
  }, [mapsBoundaryConfigured]);

  useEffect(() => {
    areaSegmentsRef.current = areaSegments;
  }, [areaSegments]);

  useEffect(() => {
    selectedBoundaryPlaceIdsRef.current = selectedBoundaryPlaceIds;
  }, [selectedBoundaryPlaceIds]);

  useEffect(() => {
    areaSelectionModeRef.current = areaSelectionMode;
  }, [areaSelectionMode]);

  useEffect(() => {
    if (isPublicPlanner) {
      setWarehouseOptionsStatus("ready");
      return;
    }
    let active = true;
    setWarehouseOptionsStatus("loading");
    fetch("/api/customer/warehouses")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!active) return;
        const warehouses = Array.isArray(payload?.data) ? payload.data as CustomerWarehouse[] : [];
        setWarehouseOptions(warehouses);
        setWarehouseOptionsStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setWarehouseOptions([]);
        setWarehouseOptionsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [isPublicPlanner]);

  const areaSegmentsPayload = useMemo(() => {
    const currentSegments = areaSegments.map((segment) => ({ ...segment, points: [...segment.points] }));
    if (polygon.length < 3) return currentSegments.filter((segment) => segment.points.length >= 3);
    const currentSegment = {
      id: activeSegmentId ?? "segment-current",
      name: targetAreaName || [postalCode, city].filter(Boolean).join(" ") || "Verteilgebiet",
      city,
      postalCode,
      district: currentSegments.find((segment) => segment.id === activeSegmentId)?.district ?? "",
      country: "DE",
      points: [...polygon],
      polygonSource,
      distributionAreaId: selectedAreaId || undefined,
    } satisfies OrderAreaSegmentDraft;
    const existingIndex = currentSegments.findIndex((segment) => segment.id === currentSegment.id);
    if (existingIndex >= 0) currentSegments[existingIndex] = { ...currentSegments[existingIndex], ...currentSegment };
    else currentSegments.push(currentSegment);
    return currentSegments.filter((segment) => segment.points.length >= 3);
  }, [activeSegmentId, areaSegments, city, polygon, polygonSource, postalCode, selectedAreaId, targetAreaName]);
  const coverageAreaSqm = useMemo(
    () => areaSegmentsPayload.reduce((sum, segment) => sum + polygonAreaSqm(segment.points), 0),
    [areaSegmentsPayload],
  );
  // Show the local drawing preview immediately. Server-backed pricing and
  // order data continue to use the committed polygon in areaSegmentsPayload.
  const previewCoverageAreaSqm = drawingPoints.length >= 3
    ? polygonAreaSqm(drawingPoints)
    : coverageAreaSqm;
  const perimeterMeters = useMemo(
    () => areaSegmentsPayload.reduce((sum, segment) => sum + polygonPerimeterMeters(segment.points), 0),
    [areaSegmentsPayload],
  );
  const localHouseholds = useMemo(() => coverageAreaSqm > 0 ? estimateHouseholdsFromArea(coverageAreaSqm) : 0, [coverageAreaSqm]);
  const localRouteDistanceMeters = useMemo(
    () => estimateWalkingDistanceMeters(coverageAreaSqm, perimeterMeters, localHouseholds),
    [coverageAreaSqm, localHouseholds, perimeterMeters],
  );
  const localRouteDurationMinutes = useMemo(
    () => estimateTeamDurationMinutes(localRouteDistanceMeters, localHouseholds, flyerQuantity),
    [flyerQuantity, localHouseholds, localRouteDistanceMeters],
  );
  const intelligenceRequestQuery = useMemo(() => new URLSearchParams({
    serviceType,
    city,
    postalCode,
    street,
    houseNumber,
    placeId: selectedLocation?.placeId ?? "",
    locationSource: selectedLocation?.source ?? "",
    latitude: selectedLocation?.lat == null ? "" : String(selectedLocation.lat),
    longitude: selectedLocation?.lng == null ? "" : String(selectedLocation.lng),
    distributionAreaId: selectedAreaId,
    flyerQuantity: String(flyerQuantity),
    flyerSource,
    productFormat,
    weightClass: effectiveWeightClass,
    weightInGrams: numericWeightInGrams === undefined ? "" : String(numericWeightInGrams),
    clientDifficultyHint: "NORMAL",
    printDataStatus,
    preferredStartDate: startDate,
    preferredEndDate: endDate,
    coverageAreaSqm: String(coverageAreaSqm),
    distanceMeters: String(localRouteDistanceMeters),
    perimeterMeters: String(perimeterMeters),
    segments: JSON.stringify(areaSegmentsPayload.map((segment) => ({
      name: segment.name,
      city: segment.city,
      postalCode: segment.postalCode,
      district: segment.district,
      country: segment.country,
      geometryGeoJson: polygonToGeoJson(segment.points),
      distributionAreaId: segment.distributionAreaId,
      flyerQuantity: segment.flyerQuantity,
      notes: segment.notes,
    }))),
  }).toString(), [
    areaSegmentsPayload,
    city,
    coverageAreaSqm,
    flyerQuantity,
    flyerSource,
    effectiveWeightClass,
    houseNumber,
    selectedLocation,
    localRouteDistanceMeters,
    perimeterMeters,
    postalCode,
    selectedAreaId,
    printDataStatus,
    productFormat,
    numericWeightInGrams,
    serviceType,
    street,
    startDate,
    endDate,
  ]);
  const {
    intelligence,
    intelligenceStatus,
    isPending,
    isConfirmed: isIntelligenceConfirmed,
    reset: resetIntelligence,
  } = useOrderIntelligence({
    endpoint: intelligenceEndpoint,
    requestQuery: intelligenceRequestQuery,
    city,
    postalCode,
    coverageAreaSqm,
  });


  const households = intelligence?.metrics.households ?? localHouseholds;
  const selectedWarehouse = warehouseOptions.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null;
  const routeDistanceMeters = intelligence?.metrics.routeDistanceMeters ?? localRouteDistanceMeters;
  const routeDurationMinutes = intelligence?.metrics.routeDurationMinutes ?? localRouteDurationMinutes;
  const netPrice = intelligence?.metrics.netPrice ?? "0";
  const vatAmount = intelligence?.metrics.vatAmount ?? "0";
  const grossPrice = intelligence?.metrics.grossPrice ?? "0";
  const pricePreviewTextLegacy = Number(netPrice) > 0
    ? formatCurrency(netPrice)
    : coverageAreaSqm > 0 && intelligenceStatus === "error"
      ? "Preis wird von FLYERO geprüft"
      : coverageAreaSqm > 0
        ? "Preis wird aktualisiert"
        : "Gebiet auf der Karte auswählen";
  const priceRequiresReview = Boolean(intelligence?.metrics.needsManualReview || intelligence?.metrics.manualReviewRequired);
  const priceReady = intelligenceStatus === "live" && !priceRequiresReview && Number(netPrice) > 0;
  const pricePreviewText = coverageAreaSqm <= 0
    ? "Gebiet auswählen"
    : intelligenceStatus === "error" || priceRequiresReview
      ? "Preis wird von FLYERO geprüft"
      : priceReady
        ? formatCurrency(netPrice)
        : pricePreviewTextLegacy;
  const distributorNeed = intelligence?.metrics.distributorNeed ?? Math.max(1, Math.ceil(localRouteDurationMinutes / 240), Math.ceil(flyerQuantity / 3500));
  const recommendedFlyerQuantity = intelligence?.metrics.recommendedFlyerQuantity ?? MINIMUM_FLYER_QUANTITY;
  const deliverabilityScore = intelligence?.metrics.score ?? null;
  const calculationConfidence = intelligence?.metrics.confidence ?? (intelligenceStatus === "live" ? "medium" : "low");
  const calculationSource = intelligence?.metrics.source ?? (intelligenceStatus === "live" ? "Gebietsdaten" : "lokale Gebietsschätzung");
  const householdCountSource = intelligence?.metrics.householdCountSource ?? (intelligenceStatus === "live" ? "area-density-formula" : "client-area-estimate");
  const pricingVersion = intelligence?.metrics.pricingVersion ?? "pricing-rule-pending";
  useEffect(() => {
    if (isPublicPlanner || selectedWarehouseId || !intelligence?.warehouse?.id) return;
    if (warehouseOptions.some((warehouse) => warehouse.id === intelligence.warehouse?.id)) {
      setSelectedWarehouseId(intelligence.warehouse.id);
    }
  }, [intelligence?.warehouse?.id, isPublicPlanner, selectedWarehouseId, warehouseOptions]);

  const geoJson = useMemo(() => segmentsToGeoJson(areaSegmentsPayload), [areaSegmentsPayload]);
  const areaStats = useMemo(() => ({
    polygonSource,
    areaKm2: coverageAreaSqm / 1_000_000,
    householdCount: households,
    recommendedFlyerQuantity,
    pricePreview: netPrice,
    walkingDistanceKm: routeDistanceMeters / 1000,
    deliveryDurationMinutes: routeDurationMinutes,
    warehouseSuggestion: selectedWarehouse
      ? `${selectedWarehouse.name} · ${selectedWarehouse.postalCode} ${selectedWarehouse.city}`
      : intelligence?.metrics.needsManualReview ? null : intelligence?.warehouse?.city ?? null,
    distributorDemand: distributorNeed,
    deliverabilityScore,
    source: calculationSource,
    confidence: calculationConfidence,
    calculatedAt: intelligence?.metrics.calculatedAt ?? new Date().toISOString(),
    calculationVersion: intelligence?.metrics.calculationVersion ?? "client-area-estimate-v1",
    householdCountSource,
    pricingVersion,
    needsManualReview: intelligence?.metrics.needsManualReview ?? false,
    segments: areaSegmentsPayload.map((segment) => ({
      name: segment.name,
      city: segment.city,
      postalCode: segment.postalCode,
      areaSqm: polygonAreaSqm(segment.points),
      flyerQuantity: segment.flyerQuantity,
    })),
    areaReference: {
      distributionAreaId: intelligence?.metrics.areaReference?.distributionAreaId ?? selectedAreaId ?? null,
      targetAreaName,
      city,
      postalCode,
      polygonSource,
      coverageAreaSqm,
      sourceAreaCoverageAreaSqm: intelligence?.metrics.areaReference?.coverageAreaSqm ?? null,
      estimateMethod: intelligence?.metrics.areaReference?.estimateMethod ?? null,
      estimateSource: intelligence?.metrics.areaReference?.estimateSource ?? null,
      estimateConfidence: intelligence?.metrics.areaReference?.estimateConfidence ?? null,
    },
  }), [
    calculationConfidence,
    calculationSource,
    coverageAreaSqm,
    city,
    deliverabilityScore,
    distributorNeed,
    netPrice,
    households,
    householdCountSource,
    intelligence?.metrics.areaReference?.coverageAreaSqm,
    intelligence?.metrics.areaReference?.distributionAreaId,
    intelligence?.metrics.areaReference?.estimateConfidence,
    intelligence?.metrics.areaReference?.estimateMethod,
    intelligence?.metrics.areaReference?.estimateSource,
    intelligence?.metrics.calculatedAt,
    intelligence?.metrics.calculationVersion,
    intelligence?.warehouse?.city,
    intelligence?.metrics.needsManualReview,
    areaSegmentsPayload,
    polygonSource,
    postalCode,
    pricingVersion,
    selectedAreaId,
    recommendedFlyerQuantity,
    routeDistanceMeters,
    routeDurationMinutes,
    selectedWarehouse,
    targetAreaName,
  ]);

  const orderDraft = useMemo<OrderDraft>(() => ({
    activeStep,
    query,
    selectedLocation,
    selectedAreaId,
    city,
    postalCode,
    street,
    houseNumber,
    targetAreaName,
    center,
    polygon,
    polygonSource,
    areaSegments: areaSegmentsPayload,
    areaStats,
    flyerQuantity,
    warehouseId: selectedWarehouseId,
    serviceType,
    weightInGrams: numericWeightInGrams,
    productDetails,
    samplingDetails: serviceType === "PRODUCT_SAMPLING" ? samplingDetails : undefined,
    flyerQuantityTouched,
    productFormat,
    flyerSource,
    printDataStatus,
    targetGroup,
    distributionType,
    startDate,
    endDate,
    flexibleScheduling,
    contactPerson,
    contactPhone,
    notes,
  }), [
    activeStep,
    areaSegmentsPayload,
    areaStats,
    center,
    city,
    contactPerson,
    contactPhone,
    distributionType,
    endDate,
    flyerQuantity,
    flyerQuantityTouched,
    flyerSource,
    houseNumber,
    notes,
    numericWeightInGrams,
    polygon,
    polygonSource,
    postalCode,
    printDataStatus,
    productFormat,
    productDetails,
    query,
    samplingDetails,
    selectedAreaId,
    selectedLocation,
    selectedWarehouseId,
    serviceType,
    startDate,
    street,
    targetAreaName,
    targetGroup,
    flexibleScheduling,
  ]);
  const { clearDraft } = useOrderDraft({
    draft: orderDraft,
    draftRestored,
    draftStorageKey,
    isPublicPlanner,
    initialLocation: initialLocationProp,
    city,
    postalCode,
    onStatusChange: setDraftStatus,
  });

  const warehouseSuggestionLabel = coverageAreaSqm > 0
    ? areaStats.warehouseSuggestion ?? (intelligenceStatus === "live" ? "Wird von FLYERO geprüft" : "Wird zugeordnet")
    : "Gebiet auswählen";

  const findAreaForLocation = useCallback((result: LocationResult) => {
    const resultCity = normalizeLocationPart(result.city);
    const resultPostalCode = (result.postalCode ?? "").trim();
    const scored = areas
      .map((area) => {
        const areaCity = normalizeLocationPart(area.city);
        const areaPostalCode = (area.postalCode ?? "").trim();
        const points = featurePoints(area.geoJson);
        const score =
          (resultPostalCode && areaPostalCode === resultPostalCode ? 60 : 0) +
          (resultPostalCode && areaPostalCode.startsWith(resultPostalCode.slice(0, 3)) ? 18 : 0) +
          (resultCity && areaCity === resultCity ? 30 : 0) +
          (points.length >= 3 ? 10 : 0) +
          (area.estimatedHouseholds ? 4 : 0);
        return { area, points, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0] ?? null;
  }, [areas]);

  // Google can display a boundary layer without returning a polygon that the
  // order can actually use. Only expose boundary selection for stored,
  // reusable geometry; every other location stays on the reliable draw path.
  const hasReusableBoundaryGeometry = areas.some((area) => Boolean(area.googlePlaceId) && featurePoints(area.geoJson).length >= 3);
  const boundarySelectionEnabled = boundaryLayerStatus === "available" && hasReusableBoundaryGeometry;

  const selectBoundaryArea = useCallback((placeId: string) => {
    const area = areas.find((candidate) => candidate.googlePlaceId === placeId);
    if (!area) {
      const endpoint = isPublicPlanner ? "/api/public/planner/geocode" : "/api/maps/geocode";
      fetch(`${endpoint}?${new URLSearchParams({ placeId, q: query, postalCode, city }).toString()}`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          const result = payload?.data as LocationResult | null;
          if (!result) {
            setAreaSelectionMode("draw");
            setMapNotice("Kartenbereich gefunden. Zeichne jetzt dein genaues Verteilgebiet direkt auf der Karte.");
            return;
          }
          applyLocationResultRef.current(result, { forceReplace: true });
          setAreaSelectionMode("draw");
          setMapNotice("Ort übernommen. Zeichne dein genaues Verteilgebiet direkt auf der Karte.");
        })
        .catch(() => {
          setAreaSelectionMode("draw");
          setMapNotice("Kartenbereich gefunden. Zeichne jetzt dein genaues Verteilgebiet direkt auf der Karte.");
        });
      return;
    }
    const points = featurePoints(area.geoJson);
    if (points.length < 3) {
      setAreaSelectionMode("draw");
      setMapNotice("Für dieses Gebiet liegt noch keine geprüfte Flächenkarte vor. FLYERO prüft es gerne manuell für dich.");
      return;
    }

    const currentSegments = areaSegmentsRef.current;
    const existingSegment = currentSegments.find((segment) => segment.distributionAreaId === area.id);
    const replaceDefault = !existingSegment && currentSegments.length === 1 && currentSegments[0]?.id === "segment-default";
    const segmentId = existingSegment?.id ?? (replaceDefault ? "segment-default" : `segment-boundary-${Date.now()}`);
    const nextSegment: OrderAreaSegmentDraft = {
      id: segmentId,
      name: area.name,
      city: area.city ?? "",
      postalCode: area.postalCode ?? "",
      district: area.district ?? "",
      country: "DE",
      points,
      polygonSource: "saved_area",
      distributionAreaId: area.id,
    };
    const nextSegments = existingSegment
      ? currentSegments.map((segment) => segment.id === existingSegment.id ? { ...segment, ...nextSegment } : segment)
      : replaceDefault
        ? [nextSegment]
        : [...currentSegments, nextSegment];

    areaSegmentsRef.current = nextSegments;
    setAreaSegments(nextSegments);
    setActiveSegmentId(segmentId);
    setSelectedAreaId(area.id);
    setPolygon(points);
    setPolygonSource("saved_area");
    setCity(area.city ?? "");
    setPostalCode(area.postalCode ?? "");
    setTargetAreaName(area.name);
    setQuery([area.postalCode, area.city].filter(Boolean).join(" "));
    if (area.centerLat && area.centerLng) setCenter({ lat: area.centerLat, lng: area.centerLng });
    setSelectedBoundaryPlaceIds((current) => current.includes(placeId) ? current : [...current, placeId]);
    setAreaSelectionMode("boundary");
    setMapNotice(`${area.name} ausgewählt. Du kannst weitere Gebiete direkt anklicken.`);
  }, [areas, city, isPublicPlanner, postalCode, query]);

  useEffect(() => {
    selectBoundaryAreaRef.current = selectBoundaryArea;
  }, [selectBoundaryArea]);

  const pushPolygon = useCallback((next: LatLng[], source: PolygonSource = "drawn") => {
    setPolygon(next);
    setPolygonSource(source);
    setHistory((current) => [...current.slice(0, historyIndex + 1), next]);
    setHistoryIndex((index) => index + 1);
  }, [historyIndex]);

  const addSegment = useCallback(() => {
    const id = `segment-${Date.now()}`;
    setAreaSegments((current) => {
      if (polygon.length < 3) return current;
      const existingIndex = current.findIndex((segment) => segment.id === activeSegmentId);
      const currentSegment: OrderAreaSegmentDraft = {
        id: activeSegmentId ?? `segment-${Date.now()}-current`,
        name: targetAreaName || [postalCode, city].filter(Boolean).join(" ") || "Verteilgebiet",
        city,
        postalCode,
        district: existingIndex >= 0 ? current[existingIndex].district : "",
        country: "DE",
        points: [...polygon],
        polygonSource,
        distributionAreaId: selectedAreaId || undefined,
      };
      const next = existingIndex >= 0
        ? current.map((segment, index) => index === existingIndex ? currentSegment : segment)
        : [...current, currentSegment];
      return [...next, {
        id,
        name: `Teilgebiet ${next.length + 1}`,
        city: "",
        postalCode: "",
        district: "",
        country: "DE",
        points: [],
        polygonSource: "drawn",
      }];
    });
    setActiveSegmentId(id);
    setPolygon([]);
    setPolygonSource("drawn");
    setSelectedAreaId("");
    setTargetAreaName("");
    setCity("");
    setPostalCode("");
    setStreet("");
    setHouseNumber("");
    setQuery("");
    setMapNotice("Neues Teilgebiet bereit. Suche jetzt eine weitere PLZ, Stadt oder Adresse.");
  }, [activeSegmentId, city, polygon, polygonSource, postalCode, selectedAreaId, targetAreaName]);

  const selectSegment = useCallback((segment: OrderAreaSegmentDraft) => {
    setActiveSegmentId(segment.id);
    setCity(segment.city);
    setPostalCode(segment.postalCode);
    setTargetAreaName(segment.name);
    setSelectedAreaId(segment.distributionAreaId ?? "");
    setPolygon(segment.points);
    setPolygonSource(segment.polygonSource);
    if (segment.points.length) {
      const nextCenter = segment.points.reduce((centerValue, point) => ({
        lat: centerValue.lat + point.lat / segment.points.length,
        lng: centerValue.lng + point.lng / segment.points.length,
      }), { lat: 0, lng: 0 });
      setCenter(nextCenter);
    }
    setMapNotice(`${segment.name} ausgewählt. Du kannst die Fläche auf der Karte anpassen.`);
  }, []);

  const removeSegment = useCallback((segmentId: string) => {
    setAreaSegments((current) => {
      const next = current.filter((segment) => segment.id !== segmentId);
      const replacement = next[next.length - 1];
      if (segmentId === activeSegmentId) {
        setActiveSegmentId(replacement?.id ?? null);
        setPolygon(replacement?.points ?? []);
        setPolygonSource(replacement?.polygonSource ?? "drawn");
        setCity(replacement?.city ?? "");
        setPostalCode(replacement?.postalCode ?? "");
        setTargetAreaName(replacement?.name ?? "");
      }
      return next;
    });
  }, [activeSegmentId]);

  // Explicit public navigation data wins over any saved browser state.
  useEffect(() => {
    try {
      const initialLocation = isPublicPlanner ? initialLocationProp : null;
      const hasExplicitLocation = hasExplicitPublicLocationContext(initialLocation);
      if (initialLocation) initialSearchRef.current = initialLocation;
      const stalePublicDraft = isPublicPlanner ? window.localStorage.getItem(PUBLIC_ORDER_DRAFT_KEY) : null;
      if (stalePublicDraft) {
        window.localStorage.removeItem(PUBLIC_ORDER_DRAFT_KEY);
        const discardedPayload = JSON.stringify({ eventType: "PUBLIC_STALE_DRAFT_DISCARDED", source: "public-planner", reason: "public-planner-does-not-restore-persistent-location" });
        navigator.sendBeacon?.(experienceEndpoint, new Blob([discardedPayload], { type: "application/json" }));
      }
      const rawDraft = isPublicPlanner ? null : window.localStorage.getItem(draftStorageKey) ?? window.localStorage.getItem(LEGACY_ORDER_DRAFT_KEY);
      if (!rawDraft) {
        draftRestoredRef.current = true;
        setDraftStatus("Entwurf wird automatisch gespeichert");
        setDraftRestored(true);
        return;
      }
      const draft = JSON.parse(rawDraft) as OrderDraft;
      if (draft.activeStep && draft.activeStep >= 1 && draft.activeStep <= 6) setActiveStep(draft.activeStep);
      const restoreLocation = !hasExplicitLocation;
      if (restoreLocation && draft.query) setQuery(draft.query);
      if (restoreLocation && draft.selectedLocation?.query) setSelectedLocation(draft.selectedLocation);
      if (restoreLocation && draft.selectedAreaId) setSelectedAreaId(draft.selectedAreaId);
      if (restoreLocation && draft.city) setCity(draft.city);
      if (restoreLocation && draft.postalCode) setPostalCode(draft.postalCode);
      if (restoreLocation && draft.street) setStreet(draft.street);
      if (restoreLocation && draft.houseNumber) setHouseNumber(draft.houseNumber);
      if (restoreLocation && draft.targetAreaName) setTargetAreaName(draft.targetAreaName);
      if (restoreLocation && draft.center && Number.isFinite(draft.center.lat) && Number.isFinite(draft.center.lng)) setCenter(draft.center);
      if (restoreLocation && Array.isArray(draft.areaSegments) && draft.areaSegments.length > 0) {
        const restoredSegments = draft.areaSegments.filter((segment) => Array.isArray(segment.points));
        if (restoredSegments.length > 0) {
          setAreaSegments(restoredSegments);
          setActiveSegmentId(restoredSegments[0].id);
          setCity(restoredSegments[0].city);
          setPostalCode(restoredSegments[0].postalCode);
          setTargetAreaName(restoredSegments[0].name);
          setPolygon(restoredSegments[0].points);
          setPolygonSource(restoredSegments[0].polygonSource);
          setHistory([restoredSegments[0].points]);
        }
      } else if (restoreLocation && Array.isArray(draft.polygon) && draft.polygon.length >= 3) {
        setPolygon(draft.polygon);
        setHistory([draft.polygon]);
      }
      if (restoreLocation && draft.polygonSource) setPolygonSource(draft.polygonSource);
      if (hasExplicitLocation && rawDraft) {
        window.localStorage.removeItem(draftStorageKey);
        const discardedPayload = JSON.stringify({ eventType: "PUBLIC_STALE_DRAFT_DISCARDED", source: "public-planner", reason: "explicit-location-navigation" });
        navigator.sendBeacon?.(experienceEndpoint, new Blob([discardedPayload], { type: "application/json" }));
      }
      const restoredQuantityTouched = draft.flyerQuantityTouched === true;
      setFlyerQuantityTouched(restoredQuantityTouched);
      if (restoredQuantityTouched && draft.flyerQuantity) {
        setFlyerQuantity(Math.max(MINIMUM_FLYER_QUANTITY, Math.min(MAXIMUM_FLYER_QUANTITY, draft.flyerQuantity)));
      } else {
        setFlyerQuantity(MINIMUM_FLYER_QUANTITY);
      }
      if (draft.warehouseId) setSelectedWarehouseId(draft.warehouseId);
      setFlyerSource("CUSTOMER_OWN");
      const restoredServiceType = normalizeOnlineServiceType(draft.serviceType ?? "FLYER_STANDARD");
      setServiceType(restoredServiceType);
      setProductFormat(normalizeServiceProductFormat(restoredServiceType, draft.productFormat));
      if (draft.weightInGrams) setWeightInGrams(String(draft.weightInGrams));
      const restoredSamplingDetails = draft.samplingDetails ?? draft.productDetails;
      if (restoredSamplingDetails && typeof restoredSamplingDetails === "object") setSamplingDetails((current) => ({ ...current, ...restoredSamplingDetails }));
      if (draft.printDataStatus) setPrintDataStatus(draft.printDataStatus);
      if (draft.targetGroup) setTargetGroup(draft.targetGroup);
      if (draft.distributionType) setDistributionType(draft.distributionType);
      const restoredStartDate = clampIsoDate(draft.startDate, minimumStartDate);
      const restoredEndDate = clampIsoDate(draft.endDate, restoredStartDate);
      setStartDate(restoredStartDate);
      setEndDate(restoredEndDate);
      if (typeof draft.flexibleScheduling === "boolean") setFlexibleScheduling(draft.flexibleScheduling);
      if (draft.contactPerson) setContactPerson(draft.contactPerson);
      if (draft.contactPhone) setContactPhone(draft.contactPhone);
      if (draft.notes) setNotes(draft.notes);
      setDraftStatus("Entwurf geladen");
      if (!hasExplicitLocation) {
        const restoredPayload = JSON.stringify({ eventType: "DRAFT_RESTORED", city: draft.city, postalCode: draft.postalCode, source: isPublicPlanner ? "public-planner" : "customer-planner" });
        navigator.sendBeacon?.(experienceEndpoint, new Blob([restoredPayload], { type: "application/json" }));
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      setDraftStatus("Entwurf wird automatisch gespeichert");
    } finally {
      draftRestoredRef.current = true;
      setDraftRestored(true);
    }
  }, [draftStorageKey, experienceEndpoint, initialLocationProp, isPublicPlanner, minimumStartDate]);

  useEffect(() => {
    if (isPublicPlanner || repeatLoadedRef.current) return;
    repeatLoadedRef.current = true;
    const repeatFrom = new URLSearchParams(window.location.search).get("repeatFrom");
    if (!repeatFrom) return;
    const timer = window.setTimeout(() => {
      fetch(`/api/customer/orders/${encodeURIComponent(repeatFrom)}/repeat`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          const draft = payload?.data?.draft as Partial<OrderDraft> & { targetAreaGeoJson?: unknown; center?: LatLng | null } | undefined;
          if (!draft) return;
          if (draft.query) setQuery(draft.query);
          if (draft.selectedLocation?.query) setSelectedLocation(draft.selectedLocation);
          if (draft.city) setCity(draft.city);
          if (draft.postalCode) setPostalCode(draft.postalCode);
          if (draft.street) setStreet(draft.street);
          if (draft.houseNumber) setHouseNumber(draft.houseNumber);
          if (draft.targetAreaName) setTargetAreaName(draft.targetAreaName);
          if (draft.center) setCenter(draft.center);
          if (Array.isArray(draft.areaSegments) && draft.areaSegments.length > 0) {
            const repeatedSegments = draft.areaSegments.map((segment) => ({
              ...segment,
              points: Array.isArray(segment.points) && segment.points.length >= 3
                ? segment.points
                : featurePoints((segment as OrderAreaSegmentDraft & { geometryGeoJson?: unknown }).geometryGeoJson),
              polygonSource: segment.polygonSource ?? "saved_area",
            })).filter((segment) => segment.points.length >= 3);
            setAreaSegments(repeatedSegments);
            setActiveSegmentId(repeatedSegments[0]?.id ?? null);
            setCity(repeatedSegments[0]?.city ?? draft.city ?? "");
            setPostalCode(repeatedSegments[0]?.postalCode ?? draft.postalCode ?? "");
            setTargetAreaName(repeatedSegments[0]?.name ?? draft.targetAreaName ?? "");
            setPolygon(repeatedSegments[0]?.points ?? []);
            setPolygonSource(repeatedSegments[0]?.polygonSource ?? "saved_area");
            setHistory([repeatedSegments[0]?.points ?? []]);
          } else {
            const repeatedPolygon = featurePoints(draft.targetAreaGeoJson);
            if (repeatedPolygon.length >= 3) {
              setPolygon(repeatedPolygon);
              setPolygonSource("saved_area");
              setHistory([repeatedPolygon]);
            }
          }
          if (draft.flyerQuantity) setFlyerQuantity(draft.flyerQuantity);
          setFlyerQuantityTouched(true);
          setFlyerSource("CUSTOMER_OWN");
          const repeatedServiceType = normalizeOnlineServiceType(draft.serviceType ?? "FLYER_STANDARD");
          setServiceType(repeatedServiceType);
          setProductFormat(normalizeServiceProductFormat(repeatedServiceType, draft.productFormat));
          if (draft.weightInGrams) setWeightInGrams(String(draft.weightInGrams));
          const repeatedSamplingDetails = draft.samplingDetails ?? draft.productDetails;
          if (repeatedSamplingDetails && typeof repeatedSamplingDetails === "object") setSamplingDetails((current) => ({ ...current, ...repeatedSamplingDetails }));
          if (draft.warehouseId) setSelectedWarehouseId(draft.warehouseId);
          const repeatedPrintDataStatus = draft.printDataStatus ?? "UPLOAD_LATER";
          setRepeatPrintChoice("pending");
          setPrintDataStatus(repeatedPrintDataStatus);
          const repeatedStartDate = clampIsoDate(draft.startDate, minimumStartDate);
          const repeatedEndDate = clampIsoDate(draft.endDate, repeatedStartDate);
          setStartDate(repeatedStartDate);
          setEndDate(repeatedEndDate);
          if (typeof draft.flexibleScheduling === "boolean") setFlexibleScheduling(draft.flexibleScheduling);
          if (draft.contactPerson) setContactPerson(draft.contactPerson);
          if (draft.contactPhone) setContactPhone(draft.contactPhone);
          if (draft.notes) setNotes(draft.notes);
          void fetch("/api/maps/experience", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ eventType: "ORDER_REPEATED", orderId: repeatFrom, source: "customer-order-repeat" }),
          });
          setActiveStep(1);
          setDraftStatus("Planung übernommen");
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isPublicPlanner, minimumStartDate]);


  const applyLocationResult = useCallback((result: LocationResult, options?: { forceReplace?: boolean }) => {
    if (options?.forceReplace) {
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
      for (const overlay of segmentPolygonsRef.current.values()) overlay.setMap(null);
      segmentPolygonsRef.current.clear();
      areaSegmentsRef.current = [];
      setAreaSegments([]);
      setActiveSegmentId(null);
      setSelectedBoundaryPlaceIds([]);
      setSelectedAreaId("");
      setPolygon([]);
      setCity("");
      setPostalCode("");
      setStreet("");
      setHouseNumber("");
      setTargetAreaName("");
      setSelectedLocation(null);
      setHistory([]);
      setHistoryIndex(0);
    }
    if (polygonSource === "manual" && !options?.forceReplace) {
      setPendingLocation(result);
      return;
    }
    resetIntelligence();
    const displayQuery = result.street || result.houseNumber || result.label?.includes("Straße")
      ? result.label ?? ""
      : [result.postalCode, result.city].filter(Boolean).join(" ") || result.label || "";
    setSelectedLocation({
      query: displayQuery,
      placeId: result.source === "google" ? result.placeId ?? undefined : undefined,
      postalCode: result.postalCode ?? undefined,
      city: result.city ?? undefined,
      lat: Number.isFinite(Number(result.lat)) ? Number(result.lat) : undefined,
      lng: Number.isFinite(Number(result.lng)) ? Number(result.lng) : undefined,
      source: result.source ?? "manual",
    });
    setCity(result.city ?? "");
    setPostalCode(result.postalCode ?? "");
    setStreet(result.street ?? "");
    setHouseNumber(result.houseNumber ?? "");
    if (displayQuery) setQuery(displayQuery);
    const nextCenter = { lat: Number(result.lat), lng: Number(result.lng) };
    if (Number.isFinite(nextCenter.lat) && Number.isFinite(nextCenter.lng)) {
      mapRef.current?.setCenter(nextCenter);
      mapRef.current?.setZoom(result.street ? 16 : 14);
      const matchedArea = findAreaForLocation(result);
      if (matchedArea?.points.length) {
        const matchedCenter = areaCenter(matchedArea.area, nextCenter);
        setCenter(matchedCenter);
        setSelectedAreaId(matchedArea.area.id);
        setTargetAreaName(matchedArea.area.name);
        const currentSegments = options?.forceReplace ? [] : areaSegmentsRef.current;
        const existingSegment = currentSegments.find((segment) => segment.distributionAreaId === matchedArea.area.id);
        const segmentId = existingSegment?.id ?? activeSegmentId ?? `segment-${Date.now()}`;
        const nextSegment: OrderAreaSegmentDraft = {
          id: segmentId,
          name: matchedArea.area.name,
          city: matchedArea.area.city ?? "",
          postalCode: matchedArea.area.postalCode ?? "",
          district: matchedArea.area.district ?? "",
          country: "DE",
          points: matchedArea.points,
          polygonSource: "saved_area",
          distributionAreaId: matchedArea.area.id,
        };
        const nextSegments = existingSegment
          ? currentSegments.map((segment) => segment.id === existingSegment.id ? { ...segment, ...nextSegment } : segment)
          : [...currentSegments, nextSegment];
        areaSegmentsRef.current = nextSegments;
        setAreaSegments(nextSegments);
        setActiveSegmentId(segmentId);
        pushPolygon(matchedArea.points, "saved_area");
      } else {
        setCenter(nextCenter);
        setSelectedAreaId("");
        setTargetAreaName(result.city ? `${result.postalCode ? `${result.postalCode} ` : ""}${result.city}` : "Verteilgebiet");
        setPolygon([]);
        setPolygonSource("postal_code");
        setHistory([]);
        setHistoryIndex(0);
        areaSegmentsRef.current = [];
        setAreaSegments([]);
        setAreaSelectionMode("draw");
        setMapNotice("Ort gefunden. Zeichne jetzt dein genaues Verteilgebiet direkt auf der Karte.");
      }
    }
    setPendingLocation(null);
  }, [activeSegmentId, findAreaForLocation, polygonSource, pushPolygon, resetIntelligence]);

  useEffect(() => {
    applyLocationResultRef.current = applyLocationResult;
  }, [applyLocationResult]);

  const geocodeAddress = useCallback((input?: string, placeId?: string, expectedLocation?: Pick<PublicLocationContext, "postalCode" | "city">, options?: { initial?: boolean }) => {
    const currentQuery = input ?? searchInputRef.current?.value ?? query;
    const requestId = ++locationRequestSequenceRef.current;
    locationAbortRef.current?.abort();
    const controller = new AbortController();
    locationAbortRef.current = controller;
    setMapNotice("Standort wird gesucht...");
    const params = new URLSearchParams({ q: currentQuery.trim() });
    const hasFreshLocationInput = Boolean(placeId || currentQuery.trim() !== query.trim());
    if (!isPublicPlanner && !hasFreshLocationInput) {
      params.set("city", city);
      params.set("postalCode", postalCode);
      params.set("street", street);
      params.set("houseNumber", houseNumber);
    } else if (expectedLocation?.postalCode) {
      params.set("postalCode", expectedLocation.postalCode);
    }
    if (isPublicPlanner && expectedLocation?.city) params.set("city", expectedLocation.city);
    if (placeId) params.set("placeId", placeId);
    if (isPublicPlanner) {
      trackPublicPlannerEvent(experienceEndpoint, options?.initial ? "PUBLIC_INITIAL_GEOCODE_STARTED" : "PUBLIC_LOCATION_SEARCH_STARTED", {
        requestId: `public-location:${requestId}`,
        postalCode: expectedLocation?.postalCode ?? (isGermanPostalCode(currentQuery) ? currentQuery.trim() : undefined),
        city: expectedLocation?.city,
      });
    }
    fetch(`${geocodeEndpoint}?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (requestId !== locationRequestSequenceRef.current) return;
        if (!response.ok) {
          if (response.status === 429) {
            setMapNotice("Die Ortssuche ist gerade ausgelastet. Bitte versuche es in einem Moment erneut.");
            return;
          }
          if (payload?.code === "PUBLIC_GEOCODE_POSTAL_MISMATCH" || payload?.code === "PUBLIC_GEOCODE_CITY_MISMATCH") {
            setMapNotice(payload.error ?? "Die eingegebene PLZ konnte nicht eindeutig gefunden werden. Bitte wählen Sie den passenden Ort aus den Vorschlägen.");
            if (isPublicPlanner) trackPublicPlannerEvent(experienceEndpoint, payload?.code, { requestId: `public-location:${requestId}` });
          } else {
            setMapNotice(payload?.error ?? "Diese Adresse wurde nicht gefunden. Bitte prüfen Sie die Eingabe oder zeichnen Sie das Gebiet direkt auf der Karte.");
            if (isPublicPlanner) trackPublicPlannerEvent(experienceEndpoint, options?.initial ? "PUBLIC_INITIAL_GEOCODE_FAILED" : "PUBLIC_LOCATION_FAILED", { requestId: `public-location:${requestId}` });
          }
          return;
        }
        const result = payload?.data;
        const expectedPostalCode = expectedLocation?.postalCode ?? (isGermanPostalCode(currentQuery) ? currentQuery.trim() : undefined);
        if (isPublicPlanner && isGermanPostalCode(expectedPostalCode) && result?.postalCode !== expectedPostalCode) {
          trackPublicPlannerEvent(experienceEndpoint, "PUBLIC_GEOCODE_POSTAL_MISMATCH", { requestId: `public-location:${requestId}`, postalCode: expectedPostalCode });
          setMapNotice("Die eingegebene PLZ konnte nicht eindeutig gefunden werden. Bitte wählen Sie den passenden Ort aus den Vorschlägen.");
          return;
        }
        if (!result) {
          if (isPublicPlanner) trackPublicPlannerEvent(experienceEndpoint, options?.initial ? "PUBLIC_INITIAL_GEOCODE_FAILED" : "PUBLIC_LOCATION_FAILED", { requestId: `public-location:${requestId}` });
          setMapNotice("Diese Adresse wurde nicht gefunden. Bitte prüfen Sie die Eingabe oder zeichnen Sie das Gebiet direkt auf der Karte.");
          return;
        }
        if (isPublicPlanner) {
          trackPublicPlannerEvent(experienceEndpoint, options?.initial ? "PUBLIC_INITIAL_GEOCODE_RESOLVED" : "LOCATION_SEARCH_COMPLETED", {
            requestId: `public-location:${requestId}`,
            city: result.city,
            postalCode: result.postalCode,
            usedAutocomplete,
          });
          trackPublicPlannerEvent(experienceEndpoint, "PUBLIC_LOCATION_REPLACED", {
            requestId: `public-location:${requestId}`,
            city: result.city,
            postalCode: result.postalCode,
          });
        }
        applyLocationResult(result, { forceReplace: !options?.initial });
      })
      .catch((error) => {
        if (requestId === locationRequestSequenceRef.current && error?.name !== "AbortError") {
          setMapNotice("Die Standortsuche konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut.");
          if (isPublicPlanner) trackPublicPlannerEvent(experienceEndpoint, options?.initial ? "PUBLIC_INITIAL_GEOCODE_FAILED" : "PUBLIC_LOCATION_FAILED", { requestId: `public-location:${requestId}` });
        }
      });
  }, [applyLocationResult, city, experienceEndpoint, geocodeEndpoint, houseNumber, isPublicPlanner, postalCode, query, street, usedAutocomplete]);

  useEffect(() => {
    if (!isPublicPlanner || !draftRestored || !draftRestoredRef.current || !initialSearchRef.current) return;
    const initialLocation = initialSearchRef.current;
    initialSearchRef.current = null;
    if (!initialLocation) return;
    setQuery(initialLocation.query);
    const timer = window.setTimeout(() => geocodeAddress(initialLocation.query, initialLocation.placeId, initialLocation, { initial: true }), 0);
    return () => window.clearTimeout(timer);
  }, [draftRestored, geocodeAddress, isPublicPlanner]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const startedPayload = JSON.stringify({
      eventType: isPublicPlanner ? "PUBLIC_PLANNER_STARTED" : "WIZARD_STARTED",
      city,
      postalCode,
      source: "order-wizard-reference-redesign",
    });
    navigator.sendBeacon?.(experienceEndpoint, new Blob([startedPayload], { type: "application/json" }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experienceEndpoint, isPublicPlanner]);

  useEffect(() => {
    if (!isPublicPlanner || trackedPublicStepsRef.current.has(activeStep)) return;
    const eventType = activeStep === 2
      ? "AREA_SELECTED"
      : activeStep === 3
        ? "FLYER_STEP_COMPLETED"
        : activeStep === 4
          ? "SCHEDULE_STEP_COMPLETED"
          : activeStep === 5
            ? "QUOTE_VIEWED"
            : activeStep === 6
              ? "AUTH_GATE_VIEWED"
              : null;
    if (!eventType) return;
    trackedPublicStepsRef.current.add(activeStep);
    void fetch(experienceEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventType, city, postalCode, areaName: targetAreaName, flyerQuantity, coverageAreaSqm }),
    });
  }, [activeStep, city, coverageAreaSqm, experienceEndpoint, flyerQuantity, isPublicPlanner, postalCode, targetAreaName]);

  useEffect(() => {
    if (!mapsReady || !mapElementRef.current || !window.google?.maps) return;
    const maps = window.google.maps;
    let isActive = true;
    const clearPolygonListeners = () => {
      for (const handle of polygonListenerHandlesRef.current) {
        try {
          handle.remove?.();
        } catch {
          // Google may already have disposed the overlay during navigation.
        }
      }
      polygonListenerHandlesRef.current = [];
    };
    const syncPath = () => {
      if (!isActive) return;
      let next: LatLng[] = [];
      try {
        next = pathToPoints(polygonRef.current?.getPath() ?? { getLength: () => 0, getAt: () => ({ lat: () => 0, lng: () => 0 }), forEach: () => undefined });
      } catch {
        return;
      }
      if (next.length >= 3) {
        setPolygon(next);
        setPolygonSource("manual");
      }
    };
    const attachPolygonListeners = (target: GooglePolygon) => {
      // The drawing API can finish an overlay on a later task. Registering
      // immediately can target a disposed MVCObject and crash the wizard.
      const register = () => {
        if (!isActive || polygonRef.current !== target) return;
        let path: GooglePath;
        try {
          path = target.getPath();
        } catch {
          return;
        }
        if (!path || typeof path.getLength !== "function") return;
        clearPolygonListeners();
        const addListener = (listenerTarget: GooglePath | GooglePolygon, eventName: string, callback: () => void) => {
          try {
            const handle = typeof listenerTarget.addListener === "function"
              ? listenerTarget.addListener(eventName, callback)
              : maps.event.addListener(listenerTarget, eventName, callback);
            if (handle) polygonListenerHandlesRef.current.push(handle);
          } catch {
            // A route change can dispose a Google overlay between the checks
            // above and registration. The next current overlay will retry.
          }
        };
        addListener(path, "set_at", syncPath);
        addListener(path, "insert_at", syncPath);
        addListener(path, "remove_at", syncPath);
        addListener(target, "drag", syncPath);
        addListener(target, "dragend", syncPath);
      };
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(register);
      } else {
        window.setTimeout(register, 0);
      }
    };
    if (!mapRef.current) {
      try {
        const mapOptions: Record<string, unknown> = {
          center,
          zoom: 14,
          disableDefaultUI: true,
          mapTypeId: mapMode === "satellite" ? "satellite" : "roadmap",
        };
        if (mapsBoundaryMapId) mapOptions.mapId = mapsBoundaryMapId;
        if (!mapsBoundaryMapId && mapMode === "map") {
          mapOptions.styles = [
            { elementType: "geometry", stylers: [{ color: "#182638" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#b8c7d9" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0a1018" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#26384d" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c213a" }] },
          ];
        }
        mapRef.current = new maps.Map(mapElementRef.current, {
          ...mapOptions,
        });
      } catch {
        return () => {
          isActive = false;
        };
      }
    }
    if (!polygonRef.current && polygonStateRef.current.length >= 3) {
      try {
        polygonRef.current = new maps.Polygon({
          paths: polygonStateRef.current,
          strokeColor: "#4a90ff",
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: "#1f7aff",
          fillOpacity: 0.26,
          editable: true,
          draggable: true,
        });
        polygonRef.current.setMap(mapRef.current);
      } catch {
        polygonRef.current = null;
      }
    }
    if (polygonRef.current) {
      attachPolygonListeners(polygonRef.current);
    }
    const clearDrawingPreview = () => {
      try {
        drawingPreviewRef.current?.setMap(null);
      } catch {
        // Google may already have disposed the preview during navigation.
      }
      drawingPreviewRef.current = null;
      drawingPointsRef.current = [];
      setDrawingPoints([]);
    };
    const commitDrawnPolygon = () => {
      const next = drawingPointsRef.current;
      if (next.length < 3 || !mapRef.current) return;
      let nextPolygon: GooglePolygon;
      try {
        polygonRef.current?.setMap(null);
        nextPolygon = new maps.Polygon({
          paths: next,
          strokeColor: "#a7ff00",
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: "#1f7aff",
          fillOpacity: 0.28,
          editable: true,
          draggable: true,
        });
        nextPolygon.setMap(mapRef.current);
        polygonRef.current = nextPolygon;
      } catch {
        return;
      }
      pushPolygon(next, "drawn");
      setAreaSelectionMode("draw");
      setMapNotice("Gebiet übernommen. Du kannst die Punkte noch anpassen oder ein weiteres Teilgebiet hinzufügen.");
      clearDrawingPreview();
      attachPolygonListeners(nextPolygon);
    };
    finishDrawingRef.current = commitDrawnPolygon;
    if (mapRef.current && !drawingClickListenerRef.current) {
      try {
        const handle = maps.event.addListener(mapRef.current, "click", (event) => {
          const point = event?.latLng;
          if (areaSelectionModeRef.current !== "draw" || !point) return;
          const next = [...drawingPointsRef.current, { lat: point.lat(), lng: point.lng() }];
          drawingPointsRef.current = next;
          setDrawingPoints(next);
          if (!drawingPreviewRef.current) {
            drawingPreviewRef.current = new maps.Polygon({
              paths: next,
              strokeColor: "#a7ff00",
              strokeOpacity: 0.9,
              strokeWeight: 2,
              fillColor: "#1f7aff",
              fillOpacity: 0.12,
              clickable: false,
            });
            drawingPreviewRef.current.setMap(mapRef.current);
          } else {
            drawingPreviewRef.current.setPath(next);
          }
          setMapNotice(next.length < 3
            ? `${next.length} Punkte gesetzt. Setze mindestens drei Punkte für dein Gebiet.`
            : "Gebiet ist bereit. Klicke auf „Gebiet abschließen“, wenn die Fläche passt.");
        });
        if (handle) drawingClickListenerRef.current = handle;
      } catch {
        drawingClickListenerRef.current = null;
      }
    }
    return () => {
      isActive = false;
      clearPolygonListeners();
    };
  }, [activeSegmentId, areaSelectionMode, center, city, mapMode, mapsBoundaryMapId, mapsReady, postalCode, pushPolygon, targetAreaName]);

  useEffect(() => {
    if (!mapsReady || !mapsBoundaryConfigured || !hasReusableBoundaryGeometry || !mapRef.current || !window.google?.maps) {
      if (!hasReusableBoundaryGeometry) {
        setBoundaryLayerStatus("unavailable");
        setAreaSelectionMode("draw");
      }
      return;
    }
    const maps = window.google.maps;
    const installBoundaryLayers = () => {
      if (!mapRef.current?.getFeatureLayer) return;
      // Google documents these string feature types as the stable API surface.
      // FeatureType is not guaranteed to exist as a runtime namespace.
      const featureTypes = ["POSTAL_CODE", "LOCALITY"];
      let availableLayerCount = 0;
      for (const featureType of featureTypes) {
        if (boundaryLayerRefs.current.has(featureType)) continue;
        let layer: GoogleFeatureLayer;
        try {
          layer = mapRef.current.getFeatureLayer(featureType);
        } catch {
          continue;
        }
        if (!layer || layer.isAvailable === false) continue;
        availableLayerCount += 1;
        layer.style = boundaryLayerStyle(selectedBoundaryPlaceIdsRef.current);
        boundaryLayerRefs.current.set(featureType, layer);
        const listener = layer.addListener?.("click", (event) => {
          const placeId = event.features?.[0]?.placeId;
          if (placeId) selectBoundaryAreaRef.current(placeId);
        });
        if (listener) boundaryLayerListenersRef.current.push(listener);
      }
      if (availableLayerCount > 0 || boundaryLayerRefs.current.size > 0) {
        setBoundaryLayerStatus("available");
      } else {
        setBoundaryLayerStatus("unavailable");
        setAreaSelectionMode("draw");
        setMapNotice("Für diesen Ort liegt keine fertige Gebietsfläche vor. Zeichne dein genaues Verteilgebiet direkt auf der Karte.");
      }
    };

    installBoundaryLayers();
    if (!boundaryIdleListenerRef.current) {
      const idleListener = maps.event.addListener(mapRef.current, "idle", installBoundaryLayers);
      if (idleListener) {
        boundaryIdleListenerRef.current = idleListener;
        boundaryLayerListenersRef.current.push(idleListener);
      }
    }
  }, [hasReusableBoundaryGeometry, mapsBoundaryConfigured, mapsReady]);

  useEffect(() => {
    for (const layer of boundaryLayerRefs.current.values()) {
      layer.style = boundaryLayerStyle(selectedBoundaryPlaceIds);
    }
  }, [selectedBoundaryPlaceIds]);

  useEffect(() => {
    const boundaryLayerRefsAtMount = boundaryLayerRefs.current;
    const boundaryLayerListenersAtMount = boundaryLayerListenersRef.current;
    return () => {
      for (const handle of polygonListenerHandlesRef.current) {
        try {
          handle.remove?.();
        } catch {
          // Google may already have disposed the overlay during navigation.
        }
      }
      polygonListenerHandlesRef.current = [];
      try {
        drawingClickListenerRef.current?.remove?.();
      } catch {
        // Google may already have disposed the map during navigation.
      }
      drawingClickListenerRef.current = null;
      try {
        drawingPreviewRef.current?.setMap(null);
      } catch {
        // Google may already have disposed the preview during navigation.
      }
      drawingPreviewRef.current = null;
      drawingPointsRef.current = [];
      finishDrawingRef.current = () => undefined;
      for (const handle of boundaryLayerListenersAtMount) {
        try {
          handle.remove?.();
        } catch {
          // Google may already have disposed the feature layer during navigation.
        }
      }
      boundaryLayerListenersAtMount.length = 0;
      boundaryLayerRefsAtMount.clear();
      boundaryIdleListenerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !window.google?.maps) return;
    const maps = window.google.maps;
    const visibleSegments = new Set(areaSegmentsPayload.map((segment) => segment.id));
    for (const [segmentId, overlay] of segmentPolygonsRef.current.entries()) {
      if (!visibleSegments.has(segmentId) || segmentId === activeSegmentId) {
        overlay.setMap(null);
        segmentPolygonsRef.current.delete(segmentId);
      }
    }
    areaSegmentsPayload.forEach((segment) => {
      if (segment.id === activeSegmentId || segment.points.length < 3) return;
      let overlay = segmentPolygonsRef.current.get(segment.id);
      if (!overlay) {
        overlay = new maps.Polygon({
          paths: segment.points,
          strokeColor: "#a7ff00",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: "#1f7aff",
          fillOpacity: 0.2,
          editable: false,
          draggable: false,
        });
        overlay.setMap(mapRef.current);
        segmentPolygonsRef.current.set(segment.id, overlay);
      } else {
        overlay.setPath(segment.points);
      }
    });
    return () => undefined;
  }, [activeSegmentId, areaSegmentsPayload, mapsReady]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !window.google?.maps) return;
    mapRef.current.setMapTypeId(mapMode === "satellite" ? "satellite" : "roadmap");
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(street ? 16 : 14);
    polygonRef.current?.setPath(polygon);
    if (polygon.length < 3 || areaSegmentsPayload.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    areaSegmentsPayload.forEach((segment) => segment.points.forEach((point) => bounds.extend(point)));
    mapRef.current.fitBounds(bounds);
  }, [areaSegmentsPayload, center, mapMode, mapsReady, polygon, street]);

  function clearLocationSelection() {
    locationRequestSequenceRef.current += 1;
    locationAbortRef.current?.abort();
    resetIntelligence();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    for (const overlay of segmentPolygonsRef.current.values()) overlay.setMap(null);
    segmentPolygonsRef.current.clear();
    areaSegmentsRef.current = [];
    selectedBoundaryPlaceIdsRef.current = [];
    setSelectedAreaId("");
    setSelectedLocation(null);
    setCity("");
    setPostalCode("");
    setStreet("");
    setHouseNumber("");
    setTargetAreaName("");
    setPolygon([]);
    setPolygonSource("postal_code");
    setAreaSegments([]);
    setActiveSegmentId(null);
    setSelectedBoundaryPlaceIds([]);
    setPendingLocation(null);
    setHistory([]);
    setHistoryIndex(0);
    setCenter(isPublicPlanner ? PUBLIC_DEFAULT_CENTER : center);
    setUsedAutocomplete(false);
    setMapNotice("");
  }

  function applySuggestion(suggestion: Suggestion) {
    clearLocationSelection();
    const displayQuery = suggestion.street || suggestion.label.includes("Straße")
      ? suggestion.label
      : [suggestion.postalCode, suggestion.city].filter(Boolean).join(" ") || suggestion.label;
    setSelectedLocation({
      query: displayQuery,
      placeId: suggestion.source === "google" ? suggestion.id : undefined,
      postalCode: suggestion.postalCode || undefined,
      city: suggestion.city || undefined,
      lat: Number.isFinite(suggestion.lat) && suggestion.lat !== 0 ? suggestion.lat : undefined,
      lng: Number.isFinite(suggestion.lng) && suggestion.lng !== 0 ? suggestion.lng : undefined,
      source: suggestion.source,
    });
    setQuery(displayQuery);
    setUsedAutocomplete(true);
    setShowSuggestions(false);
    clearSuggestions();
    geocodeAddress(suggestion.label, suggestion.source === "google" ? suggestion.id : undefined, {
      postalCode: suggestion.postalCode,
      city: suggestion.city,
    });
  }

  function openSuggestions() {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setShowSuggestions(true);
  }

  function closeSuggestionsSoon() {
    blurTimerRef.current = setTimeout(() => {
      setShowSuggestions(false);
    }, 140);
  }

  function moveQuantity(delta: number) {
    setFlyerQuantityTouched(true);
    setFlyerQuantity((value) => Math.max(MINIMUM_FLYER_QUANTITY, Math.min(MAXIMUM_FLYER_QUANTITY, value + delta)));
  }

  function polygonSourceLabel() {
    if (polygonSource === "manual") return "Manuell angepasst";
    if (polygonSource === "saved_area") return "Gespeichertes Gebiet";
    if (polygonSource === "drawn") return "Gezeichnetes Gebiet";
    return "Vorschlag aus PLZ/Adresse";
  }

  function keepCurrentArea() {
    setPendingLocation(null);
    setQuery(street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}, ${postalCode} ${city}` : `${postalCode} ${city}`);
  }

  function startDrawingArea() {
    setAreaSelectionMode("draw");
    try {
      drawingPreviewRef.current?.setMap(null);
    } catch {
      // Google may already have disposed the previous preview.
    }
    drawingPreviewRef.current = null;
    drawingPointsRef.current = [];
    setDrawingPoints([]);
    if (!mapsReady || !mapRef.current) {
      setMapNotice(
        mapsBrowserKeyConfigured
          ? "Die Karte lädt noch. Bitte kurz warten und erneut versuchen."
          : "Die Karte ist gerade nicht verfügbar. Du kannst die Anfrage trotzdem senden oder FLYERO bespricht das Gebiet mit dir.",
      );
      return;
    }
    setMapNotice("Klicke auf der Karte mindestens drei Eckpunkte. Danach kannst du das Gebiet abschließen.");
  }

  function finishDrawingArea() {
    if (drawingPointsRef.current.length < 3) {
      setMapNotice("Setze mindestens drei Eckpunkte, bevor du das Gebiet abschließt.");
      return;
    }
    finishDrawingRef.current();
  }

  function trackSubmit(options?: { clearDraft?: boolean; handoffToCustomer?: boolean; eventType?: string; orderId?: string }) {
    if (options?.clearDraft !== false) clearDraft();
    if (isPublicPlanner && options?.handoffToCustomer) {
      const handoffDraft: OrderDraft = {
        activeStep: 1,
        query,
        selectedLocation,
        selectedAreaId,
        city,
        postalCode,
        street,
        houseNumber,
        targetAreaName,
        center,
        polygon,
        polygonSource,
        areaSegments: areaSegmentsPayload,
        areaStats,
        flyerQuantity,
        flyerQuantityTouched,
        serviceType,
        productFormat,
        weightInGrams: numericWeightInGrams,
        effectiveWeightClass,
        productDetails,
        samplingDetails: serviceType === "PRODUCT_SAMPLING" ? samplingDetails : undefined,
        flyerSource,
        printDataStatus,
        targetGroup,
        distributionType,
        startDate,
        endDate,
        flexibleScheduling,
        warehouseId: selectedWarehouseId || undefined,
        contactPerson,
        contactPhone,
        notes,
        quoteFingerprint: intelligence?.metrics.fingerprint,
        pricingVersion: intelligence?.metrics.pricingVersion,
        pricingRuleSignature: intelligence?.metrics.pricingRuleSignature,
        polygonHash: intelligence?.metrics.polygonHash,
        intelligenceStatus,
      };
      window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(handoffDraft));
    }
    const durationMs = Date.now() - (startedAtRef.current ?? Date.now());
    void fetch(experienceEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: options?.eventType ?? (isPublicPlanner ? "INQUIRY_SUBMITTED" : "ORDER_CREATED"),
        orderId: options?.orderId,
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
        metadata: { mapMode, serviceType, productFormat, targetGroup, distributionType, plannerMode: mode, segmentCount: areaSegmentsPayload.length },
      }),
    });
  }

  function buildOrderPayload(completionPath: "direct_payment" | "inquiry") {
    return {
      serviceType,
      city,
      postalCode,
      street,
      houseNumber,
      placeId: selectedLocation?.placeId,
      locationSource: selectedLocation?.source,
      latitude: selectedLocation?.lat,
      longitude: selectedLocation?.lng,
      targetAreaName,
      areaType: "POLYGON",
      distributionAreaId: selectedAreaId,
      targetAreaGeoJson: JSON.stringify(geoJson),
      areaSegments: JSON.stringify(areaSegmentsPayload.map((segment) => ({
        name: segment.name,
        city: segment.city,
        postalCode: segment.postalCode,
        district: segment.district,
        country: segment.country,
        geometryGeoJson: polygonToGeoJson(segment.points),
        distributionAreaId: segment.distributionAreaId,
        flyerQuantity: segment.flyerQuantity,
        notes: segment.notes,
      }))),
      polygonSource,
      coverageAreaSqm,
      estimatedHouseholds: households,
      estimatedFlyers: flyerQuantity,
      estimatedDistanceMeters: routeDistanceMeters,
      areaCalculationSnapshot: JSON.stringify(areaStats),
      centerLat: center.lat,
      centerLng: center.lng,
      flyerQuantity,
      flyerSource,
      warehouseId: isPublicPlanner ? undefined : selectedWarehouseId || undefined,
      productFormat,
      weightClass: effectiveWeightClass,
      weightInGrams: numericWeightInGrams,
      clientDifficultyHint: "NORMAL",
      productDetails,
      printDataStatus,
      completionPath,
      preferredStartDate: startDate,
      preferredEndDate: endDate,
      flexibleScheduling,
      contactPerson,
      contactPhone,
      notes: `${notes}${notes ? "\n" : ""}Zielgruppe: ${targetGroup}. Verteilung: ${distributionType}.`,
      quoteFingerprint: intelligence?.metrics.fingerprint ?? "",
    };
  }

  async function finishOrder(completionPath: "direct_payment" | "inquiry") {
    if (completionPath === "direct_payment" && serviceType === "PRODUCT_SAMPLING") {
      setFinishStatus("Produktproben prüfen wir vorab. Bitte sende ein individuelles Sampling-Angebot.");
      return;
    }
    if (flyerQuantity < MINIMUM_FLYER_QUANTITY) {
      setFlyerQuantity(MINIMUM_FLYER_QUANTITY);
      setFlyerQuantityTouched(true);
      setActiveStep(2);
      setFinishStatus(`Bitte gib mindestens ${formatNumber(MINIMUM_FLYER_QUANTITY)} Flyer an.`);
      return;
    }
    if (repeatPrintChoice === "pending") {
      setActiveStep(2);
      setFinishStatus("Bitte bestätige zuerst, ob deine Druckdaten unverändert sind.");
      return;
    }
    if (!isPublicPlanner && !selectedWarehouseId) {
      setActiveStep(2);
      setFinishStatus("Bitte wähle zuerst das Empfangslager für deine bereits gedruckten Flyer.");
      return;
    }
    if (!isPublicPlanner && (
      intelligenceStatus !== "live" ||
      !isIntelligenceConfirmed(intelligenceRequestQuery) ||
      !intelligence?.metrics.fingerprint
    )) {
      setFinishStatus("Preis wird aktualisiert. Bitte bestätige die aktuelle Planung erneut.");
      return;
    }
    if (!beginSubmission()) return;
    if (isPublicPlanner) {
      trackSubmit({
        clearDraft: false,
        handoffToCustomer: completionPath === "direct_payment",
        eventType: completionPath === "direct_payment" ? "AUTH_GATE_VIEWED" : "INQUIRY_SUBMITTED",
      });
      if (completionPath === "direct_payment") {
        window.location.href = `/register/customer?next=${encodeURIComponent("/customer/orders/new")}`;
      } else {
        window.location.href = "/verteilung-anfragen?from=planner";
      }
      return;
    }
    setFinishStatus(completionPath === "direct_payment" ? "Buchung wird vorbereitet ..." : "Anfrage wird übermittelt ...");
    try {
      trackSubmit();
      const orderResponse = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildOrderPayload(completionPath)),
      });
      const orderResult = await orderResponse.json();
      if (!orderResponse.ok || !orderResult?.data?.id) {
        throw new Error(orderResult?.error || "Deine Planung konnte nicht gespeichert werden.");
      }

      if (completionPath === "direct_payment") {
        if (orderResult.data.requiresManualReview) {
          clearDraft();
          setFinishStatus("Deine Gebiete werden vor der Buchung manuell geprüft. FLYERO meldet sich mit den nächsten Schritten bei dir.");
          window.location.href = `/customer/orders/${orderResult.data.id}?manual-review=1`;
          return;
        }
        const checkoutResponse = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: orderResult.data.id }),
        });
        const checkoutResult = await checkoutResponse.json();
        if (checkoutResponse.status === 422 && checkoutResult?.code === "CUSTOMER_PROFILE_INCOMPLETE" && checkoutResult?.data?.redirectTo) {
          window.location.href = checkoutResult.data.redirectTo;
          return;
        }
        if (!checkoutResponse.ok || !checkoutResult?.data?.checkoutUrl) {
          setFinishStatus("Zahlung konnte nicht abgeschlossen werden. Du kannst die Zahlung erneut versuchen oder die Kampagne als Anfrage senden.");
          window.location.href = `/customer/orders/${orderResult.data.id}?payment=retry`;
          return;
        }
        setFinishStatus("Buchung gespeichert. Du wirst zur Zahlung weitergeleitet.");
        window.location.href = checkoutResult.data.checkoutUrl;
        return;
      }

      clearDraft();
      setFinishStatus("Deine Anfrage wurde übermittelt. Wir prüfen Gebiet, Druck und Preis und melden uns schnell.");
      window.location.href = `/customer/orders/${orderResult.data.id}?inquiry=success`;
    } catch (error) {
      setFinishStatus(error instanceof Error ? error.message : "Die Anfrage konnte nicht abgeschlossen werden.");
    } finally {
      endSubmission();
    }
  }

  const legacyStepState = [
    { id: 1, title: "Gebiet", detail: "Wo soll verteilt werden?", value: coverageAreaSqm > 0 ? `${(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²` : "Noch offen" },
    { id: 2, title: selectedService.shortLabel, detail: "Menge und Empfangslager", value: `${formatNumber(flyerQuantity)} Stück` },
    { id: 3, title: "Verteilung", detail: "Art und wichtige Hinweise", value: distributionType === "Haushaltsverteilung" ? "Haushalte" : distributionType },
    { id: 4, title: "Zeitraum", detail: `Frühester Start ab ${formatShortDate(minimumStartDate)}`, value: formatShortDate(startDate) },
    { id: 5, title: "Preis prüfen", detail: "Gebiet, Preis und Leistungen", value: Number(netPrice) > 0 ? formatCurrency(netPrice) : "Noch offen" },
    { id: 6, title: "Abschluss", detail: "Buchen, anfragen oder Formular senden", value: "3 Wege" },
  ];
  void legacyStepState;
  const stepState = [
    { id: 1, title: "Gebiet", detail: "Ort und Fläche festlegen", value: coverageAreaSqm > 0 ? `${(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²` : "Noch offen" },
    { id: 2, title: `${selectedService.shortLabel} & Lager`, detail: "Menge und Empfangslager", value: `${formatNumber(flyerQuantity)} Stück` },
    { id: 3, title: "Verteilung", detail: "Ziel und Hinweise", value: distributionType === "Haushaltsverteilung" ? "Haushalte" : distributionType },
    { id: 4, title: "Zeitraum", detail: `Start ab ${formatShortDate(minimumStartDate)}`, value: formatShortDate(startDate) },
    { id: 5, title: "Zusammenfassung", detail: "Preis und Leistungen prüfen", value: Number(netPrice) > 0 ? formatCurrency(netPrice) : "Noch offen" },
    { id: 6, title: "Abschluss", detail: "Buchen oder unverbindlich anfragen", value: "Bereit" },
  ];
  const activeNavItems = isPublicPlanner ? publicPlannerNavItems : orderNavItems;
  const orderNavGroups = Array.from(new Set(activeNavItems.map((item) => item.group)));

  function beginOverviewDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    overviewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: overviewOffset.x,
      baseY: overviewOffset.y,
    };
  }

  function moveOverviewDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = overviewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOverviewOffset(clampOverviewOffset(
      drag.baseX + event.clientX - drag.startX,
      drag.baseY + event.clientY - drag.startY,
    ));
  }

  function endOverviewDrag(event: PointerEvent<HTMLButtonElement>) {
    if (overviewDragRef.current?.pointerId !== event.pointerId) return;
    overviewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function renderStepContent(stepId: number) {
    if (stepId === 6) {
      return <OrderFinishStep
        flyerSource={flyerSource}
        effectiveWeightClass={effectiveWeightClass}
        serviceType={serviceType}
        isFinishing={isSubmitting}
        finishStatus={finishStatus}
        inquiryFormHref={inquiryFormHref}
        inquiryMailHref={inquiryMailHref}
        onFinish={finishOrder}
      />;
    }

    if (stepId === 1) {
      return <OrderAreaStep
        query={query}
        city={city}
        postalCode={postalCode}
        street={street}
        houseNumber={houseNumber}
        searchInputRef={searchInputRef}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        pendingLocation={pendingLocation}
        boundarySelectionEnabled={boundarySelectionEnabled}
        areaSelectionMode={areaSelectionMode}
        boundaryLayerAvailable={boundaryLayerStatus === "available"}
        drawingPoints={drawingPoints}
        previewCoverageAreaSqm={previewCoverageAreaSqm}
        areaSegmentsPayload={areaSegmentsPayload}
        areaSegments={areaSegments}
        activeSegmentId={activeSegmentId}
        onQueryChange={(value) => {
          clearLocationSelection();
          setQuery(value);
          setShowSuggestions(true);
        }}
        onEnter={() => {
          setShowSuggestions(false);
          geocodeAddress();
        }}
        onSearch={() => geocodeAddress(searchInputRef.current?.value)}
        onFocus={openSuggestions}
        onBlur={closeSuggestionsSoon}
        onApplySuggestion={applySuggestion}
        onApplyPendingLocation={() => applyLocationResult(pendingLocation!, { forceReplace: true })}
        onKeepCurrentArea={keepCurrentArea}
        onEnableBoundary={() => {
          setAreaSelectionMode("boundary");
          setMapNotice("Wähle eine farbig markierte PLZ- oder Stadtfläche auf der Karte aus.");
        }}
        onStartDrawing={startDrawingArea}
        onFinishDrawing={finishDrawingArea}
        onSelectSegment={selectSegment}
        onRemoveSegment={removeSegment}
        onAddSegment={addSegment}
        polygonSourceLabel={polygonSourceLabel}
      />;
    }

    if (stepId === 2) {
      return <OrderMaterialStep
        isPublicPlanner={isPublicPlanner}
        serviceType={serviceType}
        selectedService={selectedService}
        productFormat={productFormat}
        weightInGrams={weightInGrams}
        numericWeightInGrams={numericWeightInGrams}
        effectiveWeightClass={effectiveWeightClass}
        samplingDetails={samplingDetails}
        repeatPrintChoice={repeatPrintChoice}
        warehouseOptionsStatus={warehouseOptionsStatus}
        warehouseOptions={warehouseOptions}
        selectedWarehouseId={selectedWarehouseId}
        recommendedFlyerQuantity={recommendedFlyerQuantity}
        flyerQuantity={flyerQuantity}
        onServiceTypeChange={(next) => {
          setServiceType(next);
          setProductFormat(normalizeServiceProductFormat(next));
        }}
        onProductFormatChange={(format) => setProductFormat(normalizeServiceProductFormat(serviceType, format))}
        onWeightChange={setWeightInGrams}
        onSamplingDetailsChange={(details) => setSamplingDetails(details)}
        onRepeatPrintChoice={(choice) => {
          setRepeatPrintChoice(choice);
          setPrintDataStatus("UPLOAD_LATER");
        }}
        onWarehouseChange={setSelectedWarehouseId}
        onMoveQuantity={moveQuantity}
        onQuantityChange={(quantity) => {
          setFlyerQuantityTouched(true);
          setFlyerQuantity(quantity);
        }}
        onQuantityBlur={() => setFlyerQuantity((value) => Math.max(MINIMUM_FLYER_QUANTITY, Math.min(MAXIMUM_FLYER_QUANTITY, value)))}
      />;
    }

    if (stepId === 3) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <p className="orderStepHint">Wähle, wen du erreichen möchtest. Besondere Wünsche kannst du direkt an FLYERO senden.</p>
          <label className="selectLine">
            <span>Verteilung für</span>
            <select value={distributionType} onChange={(event) => setDistributionType(event.target.value)}>
              <option value="Haushaltsverteilung">Private Haushalte</option>
              <option value="Gewerbegebiet">Gewerbe</option>
              <option value="Eventgebiet">Event- oder Aktionsgebiet</option>
            </select>
          </label>
          <label className="selectLine">
            <span>Zielgruppe</span>
            <select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}>
              <option>Alle privaten Haushalte</option>
              <option value="Familienhaushalte">Familien und Haushalte</option>
              <option>Innenstadt und Laufkundschaft</option>
              <option value="Lokale Gewerbe">Lokale Gewerbebetriebe</option>
            </select>
          </label>
          <label>
            Besondere Wünsche
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="z. B. bestimmte Straßen auslassen, Gewerbe bevorzugen oder wichtige Zugangshinweise"
            />
          </label>
        </section>
      );
    }

    if (stepId === 4) {
      return <OrderScheduleStep
        minimumStartDate={minimumStartDate}
        startDate={startDate}
        endDate={endDate}
        flexibleScheduling={flexibleScheduling}
        onStartDateChange={(value) => {
          const nextStartDate = clampIsoDate(value, minimumStartDate);
          setStartDate(nextStartDate);
          if (endDate < nextStartDate) setEndDate(nextStartDate);
        }}
        onEndDateChange={(value) => setEndDate(clampIsoDate(value, startDate))}
        onFlexibleSchedulingChange={setFlexibleScheduling}
      />;
    }

    if (stepId === 5) {
      const ownFlyers = flyerSource === "CUSTOMER_OWN";
      return <OrderSummaryStep
        postalCode={postalCode}
        city={city}
        coverageAreaSqm={coverageAreaSqm}
        service={selectedService}
        flyerQuantity={flyerQuantity}
        priceReady={priceReady}
        netPrice={netPrice}
        vatAmount={vatAmount}
        grossPrice={grossPrice}
        pricePreviewText={pricePreviewText}
        selectedWarehouse={ownFlyers ? selectedWarehouse ?? undefined : undefined}
        warehouseLabel={ownFlyers ? "Bitte auswählen" : warehouseSuggestionLabel}
        dataBasisLabel={confidenceLabel(areaStats.confidence, coverageAreaSqm > 0)}
        notice={ownFlyers
          ? "Deine Flyer sind bereits gedruckt und werden nach der Buchung an das ausgewählte Empfangslager gesendet. FLYERO prüft Gebiet und Zustellbarkeit vor der Durchführung."
          : "Nach der Zahlung prüfen wir Gebiet, Druckdatei und ob die Verteilung wie geplant möglich ist. Falls sich etwas ändert, melden wir uns."}
        contactPerson={contactPerson}
        contactPhone={contactPhone}
        notes={notes}
        onContactPersonChange={setContactPerson}
        onContactPhoneChange={setContactPhone}
        onNotesChange={setNotes}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
      />;
    }

    return <OrderFinishStep
      flyerSource={flyerSource}
      effectiveWeightClass={effectiveWeightClass}
      serviceType={serviceType}
      isFinishing={isSubmitting}
      finishStatus={finishStatus}
      inquiryFormHref={inquiryFormHref}
      inquiryMailHref={inquiryMailHref}
      onFinish={finishOrder}
    />;
  }

  return (
    <form
      className="orderExperience"
      onClick={() => setClickCount((value) => value + 1)}
      onSubmit={(event) => event.preventDefault()}
    >
      <input type="hidden" name="serviceType" value={serviceType} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="postalCode" value={postalCode} />
      <input type="hidden" name="street" value={street} />
      <input type="hidden" name="houseNumber" value={houseNumber} />
      <input type="hidden" name="placeId" value={selectedLocation?.placeId ?? ""} />
      <input type="hidden" name="locationSource" value={selectedLocation?.source ?? ""} />
      <input type="hidden" name="latitude" value={selectedLocation?.lat ?? ""} />
      <input type="hidden" name="longitude" value={selectedLocation?.lng ?? ""} />
      <input type="hidden" name="targetAreaName" value={targetAreaName} />
      <input type="hidden" name="areaType" value="POLYGON" />
      <input type="hidden" name="distributionAreaId" value={selectedAreaId} />
      <input type="hidden" name="targetAreaGeoJson" value={JSON.stringify(geoJson)} />
      <input type="hidden" name="areaSegments" value={JSON.stringify(areaSegmentsPayload.map((segment) => ({
        name: segment.name,
        city: segment.city,
        postalCode: segment.postalCode,
        district: segment.district,
        country: segment.country,
        geometryGeoJson: polygonToGeoJson(segment.points),
        distributionAreaId: segment.distributionAreaId,
        flyerQuantity: segment.flyerQuantity,
        notes: segment.notes,
      })))} />
      <input type="hidden" name="polygonSource" value={polygonSource} />
      <input type="hidden" name="coverageAreaSqm" value={coverageAreaSqm} />
      <input type="hidden" name="estimatedHouseholds" value={households} />
      <input type="hidden" name="estimatedFlyers" value={flyerQuantity} />
      <input type="hidden" name="estimatedDistanceMeters" value={routeDistanceMeters} />
      <input type="hidden" name="areaCalculationSnapshot" value={JSON.stringify(areaStats)} />
      <input type="hidden" name="centerLat" value={center.lat} />
      <input type="hidden" name="centerLng" value={center.lng} />
      <input type="hidden" name="flyerQuantity" value={flyerQuantity} />
      <input type="hidden" name="flyerSource" value={flyerSource} />
      <input type="hidden" name="warehouseId" value={selectedWarehouseId} />
      <input type="hidden" name="productFormat" value={productFormat} />
      <input type="hidden" name="weightClass" value={effectiveWeightClass} />
      <input type="hidden" name="weightInGrams" value={numericWeightInGrams ?? ""} />
      <input type="hidden" name="clientDifficultyHint" value="NORMAL" />
      <input type="hidden" name="productDetails" value={productDetails ? JSON.stringify(productDetails) : ""} />
      <input type="hidden" name="printDataStatus" value={printDataStatus} />
      <input type="hidden" name="preferredStartDate" value={startDate} />
      <input type="hidden" name="preferredEndDate" value={endDate} />
      <input type="hidden" name="flexibleScheduling" value={flexibleScheduling ? "true" : "false"} />
      <input type="hidden" name="contactPerson" value={contactPerson} />
      <input type="hidden" name="contactPhone" value={contactPhone} />
      <input type="hidden" name="notes" value={`${notes}${notes ? "\n" : ""}Zielgruppe: ${targetGroup}.`} />

      <aside className="orderSideNav customerSideNav" aria-label="Kundennavigation">
        <OrderLogo />
        {orderNavGroups.map((group) => (
          <div className="customerSideNavSection" key={group}>
            <small>{group}</small>
            {activeNavItems.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={"active" in item && item.active ? "sideNavActive" : ""}>
                  <span><Icon aria-hidden="true" /></span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="sideNavFooter">
          {isPublicPlanner ? <Link href="/verteilung-anfragen">Zur Anfrage</Link> : (
            <button
              type="button"
              onClick={() => {
                void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                  window.location.href = "/login";
                });
              }}
            >
              Ausloggen
            </button>
          )}
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
                data-testid={`order-step-${step.id}`}
                onClick={() => setActiveStep(step.id)}
              >
                <span>{step.id}</span>
                <strong>{step.id === 6 ? "Abschluss" : step.title}</strong>
                <small>{step.id === 6 ? "Weg auswählen und absenden" : step.detail}</small>
                <em>{step.id === 6 ? "Fast fertig" : step.value}</em>
              </button>
              {activeStep === step.id ? renderStepContent(step.id) : null}
            </article>
          ))}
        </div>

        <div className="orderPriceFooter">
          <span>Preis netto zzgl. MwSt.</span>
          <strong>{pricePreviewText}</strong>
          <button type="button" onClick={() => setActiveStep((step) => Math.min(6, step + 1))}>
            {activeStep >= 6 ? "Weg auswählen" : "Weiter"}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </aside>

      <section className={`orderMapStage ${mapMode}`}>
        <div className="mapChromeTop">
          <span>{postalCode} {city}</span>
        </div>
        <div className="mapTabs">
          <button type="button" className={mapMode === "map" ? "selected" : ""} onClick={() => setMapMode("map")}>Karte</button>
          <button type="button" className={mapMode === "satellite" ? "selected" : ""} onClick={() => setMapMode("satellite")}>Satellit</button>
        </div>
        {mapNotice ? <div className="mapNotice" role="status">{mapNotice}</div> : null}
        <div ref={mapElementRef} data-testid="order-map" className="orderGoogleMap" aria-hidden={!mapsReady} />
        {!mapsReady ? <MiniMapFallback /> : null}
        {!mapsReady ? (
          <div className="mapConfigNotice" role="status">
            <strong>{mapsLoadStatus === "loading" ? "Karte wird geladen" : "Karte gerade nicht verfügbar"}</strong>
            <span>
              {mapsLoadStatus === "loading"
                ? "Einen Moment bitte. Falls die Karte nicht erscheint, kannst du die Anfrage trotzdem senden."
                : "Du kannst die Anfrage trotzdem senden. FLYERO bespricht das Gebiet anschließend persönlich mit dir."}
            </span>
          </div>
        ) : null}
        <div className="mapZoomRail" aria-label="Kartensteuerung">
          <button type="button" onClick={() => geocodeAddress()} aria-label="Aktuelle Adresse zentrieren"><LocateFixed aria-hidden="true" /></button>
          <button type="button" onClick={() => mapRef.current?.setZoom(15)}>+</button>
          <button type="button" onClick={() => mapRef.current?.setZoom(13)}>−</button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Karte vergrößern"><Maximize2 aria-hidden="true" /></button>
        </div>
        <aside
          className="areaOverview"
          style={{ transform: `translate3d(${overviewOffset.x}px, ${overviewOffset.y}px, 0)` }}
        >
          <div className="overviewHead">
            <div>
              <h2>Deine Planung</h2>
              <p>Aktualisiert sich, sobald du das Gebiet änderst.</p>
            </div>
            <span className={`overviewSyncState ${intelligenceStatus}`}>
              {syncStateLabel(intelligenceStatus, areaStats.confidence, isPending, coverageAreaSqm > 0)}
            </span>
            <button
              type="button"
              className="overviewDragHandle"
              aria-label="Gebietsübersicht verschieben"
              onPointerDown={beginOverviewDrag}
              onPointerMove={moveOverviewDrag}
              onPointerUp={endOverviewDrag}
              onPointerCancel={endOverviewDrag}
            >
              Verschieben
            </button>
          </div>
          <div className="overviewMetaRow">
            <p className="overviewDataBasis">{confidenceLabel(areaStats.confidence, coverageAreaSqm > 0)}</p>
            {overviewOffset.x !== 0 || overviewOffset.y !== 0 ? (
              <button type="button" onClick={() => setOverviewOffset({ x: 0, y: 0 })}>Zurücksetzen</button>
            ) : null}
          </div>
          <dl>
            <div><dt>Fläche</dt><dd>{(previewCoverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</dd></div>
            <div><dt>Empfohlene Flyerzahl</dt><dd>{formatNumber(recommendedFlyerQuantity)} Flyer</dd></div>
            <div><dt>Preis netto zzgl. MwSt.</dt><dd>{pricePreviewText}</dd></div>
            <div><dt>Nächstes Lager</dt><dd>{warehouseSuggestionLabel}</dd></div>
          </dl>
          <p className="availabilityGood">{deliverabilityLabel(deliverabilityScore, coverageAreaSqm > 0)}</p>
        </aside>
      </section>
    </form>
  );
}


