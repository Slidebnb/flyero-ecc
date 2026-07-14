"use client";

/* eslint-disable react-hooks/set-state-in-effect -- The order wizard intentionally restores a saved browser draft and keeps recommended flyer quantities aligned with the current area calculation. */

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  CircleHelp,
  Download,
  FileStack,
  FileText,
  Mail,
  LocateFixed,
  LayoutDashboard,
  ListChecks,
  Maximize2,
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import type { ReusableAreaOption } from "@/app/components/DistributionAreaEditor";

type LatLng = { lat: number; lng: number };
type PolygonSource = "postal_code" | "manual" | "saved_area" | "drawn";
type OverviewDragState = { pointerId: number; startX: number; startY: number; baseX: number; baseY: number };
type OrderAreaSegmentDraft = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  district: string;
  country: string;
  points: LatLng[];
  polygonSource: PolygonSource;
  distributionAreaId?: string;
  flyerQuantity?: number;
  notes?: string;
};

type LocationResult = {
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  label?: string | null;
  lat: number;
  lng: number;
};

type Props = {
  areas: ReusableAreaOption[];
  today: string;
  mode?: "public_quote" | "authenticated_order";
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
    vatAmount?: string;
    vatRate?: string;
    distributorNeed: number;
    score: number;
    source?: string;
    confidence?: "high" | "medium" | "low";
    calculatedAt?: string;
    calculationVersion?: string;
    householdCountSource?: string;
    pricingVersion?: string;
    fingerprint?: string;
    polygonHash?: string;
    pricingRuleSignature?: string;
    quote?: {
      fingerprint: string;
      polygonHash: string;
      pricingVersion: string;
      pricingRuleSignature: string;
    };
    areaReference?: {
      distributionAreaId: string | null;
      name: string | null;
      city: string | null;
      postalCode: string | null;
      coverageAreaSqm: number | null;
      estimateMethod: string | null;
      estimateSource: string | null;
      estimateConfidence: number | null;
    };
    segments?: Array<{
      name: string;
      city: string | null;
      postalCode: string | null;
      coverageAreaSqm: number;
      households: number;
      householdCountSource: string;
      confidence: "high" | "medium" | "low";
      distributionAreaId: string | null;
    }>;
    needsManualReview?: boolean;
  };
  warehouse?: { id: string; name: string; code: string; city: string; reason: string } | null;
  combinations?: Array<{ key: string; orders: unknown[]; savedDistanceMeters: number; savedMinutes: number; savedCostEstimate: string }>;
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
  polygonSource?: PolygonSource;
  areaSegments?: OrderAreaSegmentDraft[];
  areaStats?: {
    polygonSource: PolygonSource;
    areaKm2: number;
    householdCount: number;
    recommendedFlyerQuantity: number;
    pricePreview: string;
    walkingDistanceKm: number;
    deliveryDurationMinutes: number;
    warehouseSuggestion: string | null;
    distributorDemand: number;
    deliverabilityScore: number | null;
    source: string;
    confidence: "high" | "medium" | "low";
    calculatedAt: string;
    calculationVersion: string;
    householdCountSource: string;
    pricingVersion: string;
    needsManualReview?: boolean;
    segments?: Array<{ name: string; city: string; postalCode: string; areaSqm: number; flyerQuantity?: number }>;
    areaReference: {
      distributionAreaId: string | null;
      targetAreaName: string;
      city: string;
      postalCode: string;
      polygonSource: PolygonSource;
      coverageAreaSqm: number;
      sourceAreaCoverageAreaSqm: number | null;
      estimateMethod: string | null;
      estimateSource: string | null;
      estimateConfidence: number | null;
    };
  };
  flyerQuantity?: number;
  flyerQuantityTouched?: boolean;
  productFormat?: string;
  flyerSource?: string;
  printDataStatus?: string;
  targetGroup?: string;
  distributionType?: string;
  startDate?: string;
  endDate?: string;
  flexibleScheduling?: boolean;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
};

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
type GoogleDrawingManager = {
  setMap: (map: GoogleMap | null) => void;
  setDrawingMode: (mode: string | null) => void;
  addListener?: (eventName: string, callback: (overlay?: unknown) => void) => GoogleEventListener | void;
};
type GoogleNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Polygon: new (options: Record<string, unknown>) => GooglePolygon;
    LatLngBounds: new () => { extend: (point: LatLng) => void };
    event: { addListener: (target: unknown, eventName: string, callback: (event?: unknown) => void) => GoogleEventListener | void };
    FeatureType?: { POSTAL_CODE?: string; LOCALITY?: string };
    drawing?: {
      OverlayType: { POLYGON: string };
      DrawingManager: new (options: Record<string, unknown>) => GoogleDrawingManager;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleNamespace;
    __flyeroMapsLoading?: Promise<void>;
  }
}

const DEFAULT_CENTER = { lat: 50.3569, lng: 7.589 };
const PUBLIC_DEFAULT_CENTER: LatLng = { lat: 51.1657, lng: 10.4515 };
const DEFAULT_POLYGON: LatLng[] = [
  { lat: 50.3602, lng: 7.5852 },
  { lat: 50.3618, lng: 7.5934 },
  { lat: 50.3567, lng: 7.5988 },
  { lat: 50.3515, lng: 7.596 },
  { lat: 50.3502, lng: 7.5873 },
  { lat: 50.3548, lng: 7.5818 },
];

const ORDER_DRAFT_KEY = "flyero:order-planner:draft:v2";
const PUBLIC_ORDER_DRAFT_KEY = "flyero:order-planner:public-draft:v2";
const LEGACY_ORDER_DRAFT_KEY = "flyero:customer:new-order-draft";

const productOptions = [
  { value: "DIN Lang (99 × 210 mm)", label: "DIN Lang (99 × 210 mm)" },
  { value: "A5 Flyer", label: "A5 Flyer" },
  { value: "A6 Flyer", label: "A6 Flyer" },
];

const inquiryFormHref = "/downloads/flyero-anfrageformular.html";
const inquiryMailHref = "mailto:anfrage@flyero.de?subject=Flyerverteilung%20anfragen&body=Hallo%20FLYERO%2C%0A%0Aich%20m%C3%B6chte%20eine%20Flyerverteilung%20anfragen.%0A%0AFirma%3A%0AAnsprechpartner%3A%0ATelefon%3A%0AE-Mail%3A%0AVerteilgebiet%2FPLZ%2FOrt%3A%0AFlyeranzahl%3A%0AWunschzeitraum%3A%0ABemerkungen%3A";

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

function polygonAroundCenter(nextCenter: LatLng) {
  return DEFAULT_POLYGON.map((point) => ({
    lat: point.lat + (nextCenter.lat - DEFAULT_CENTER.lat),
    lng: point.lng + (nextCenter.lng - DEFAULT_CENTER.lng),
  }));
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

function recommendedFlyersForHouseholds(households: number) {
  return Math.max(500, Math.ceil((Math.max(0, households) * 1.1) / 100) * 100);
}

function confidenceLabel(confidence?: "high" | "medium" | "low") {
  if (confidence === "high") return "Gebietsdaten geprüft";
  if (confidence === "medium") return "Gebiet aus verfügbaren Daten berechnet";
  return "Gebiet wird nach der Anfrage geprüft";
}

function syncStateLabel(status: "local" | "updating" | "live" | "error", confidence?: "high" | "medium" | "low", pending?: boolean) {
  if (status === "updating" || pending) return "Wird aktualisiert";
  if (status === "live" && confidence === "high") return "Gebiet geprüft";
  if (status === "live") return "Gebiet berechnet";
  if (status === "error") return "Vorläufige Schätzung";
  return "Vorläufige Schätzung";
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

function deliverabilityLabel(score?: number | null) {
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
      && window.google.maps.drawing?.DrawingManager
      && window.google.maps.LatLngBounds,
  );
  if (isReady()) return Promise.resolve(true);
  if (!window.__flyeroMapsLoading) {
    window.__flyeroMapsLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=3.64&loading=async&libraries=drawing,geometry,places`;
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

export function SmartOrderWizard({ areas, today, mode = "authenticated_order" }: Props) {
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
  const forceLocationReplaceRef = useRef(false);
  const lastIntelligenceRequestRef = useRef<string | null>(null);
  const intelligenceAbortRef = useRef<AbortController | null>(null);
  const confirmedIntelligenceRequestRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const polygonRef = useRef<GooglePolygon | null>(null);
  const polygonListenerHandlesRef = useRef<GoogleEventListener[]>([]);
  const drawingManagerListenerRef = useRef<GoogleEventListener | null>(null);
  const segmentPolygonsRef = useRef(new Map<string, GooglePolygon>());
  const drawingManagerRef = useRef<GoogleDrawingManager | null>(null);
  const boundaryLayerRefs = useRef(new Map<string, GoogleFeatureLayer>());
  const boundaryLayerListenersRef = useRef<GoogleEventListener[]>([]);
  const boundaryIdleListenerRef = useRef<GoogleEventListener | null>(null);
  const selectedBoundaryPlaceIdsRef = useRef<string[]>([]);
  const areaSegmentsRef = useRef<OrderAreaSegmentDraft[]>([]);
  const selectBoundaryAreaRef = useRef<(placeId: string) => void>(() => undefined);
  const overviewDragRef = useRef<OverviewDragState | null>(null);
  const initialSearchRef = useRef<string | null>(null);
  const trackedPublicStepsRef = useRef(new Set<number>());
  const [isPending, startTransition] = useTransition();
  const [mapsReady, setMapsReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [query, setQuery] = useState(isPublicPlanner ? "" : "Koblenz, Deutschland");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [city, setCity] = useState(isPublicPlanner ? "" : "Koblenz");
  const [postalCode, setPostalCode] = useState(isPublicPlanner ? "" : "56068");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [targetAreaName, setTargetAreaName] = useState(isPublicPlanner ? "" : "Koblenz Zentrum");
  const [center, setCenter] = useState<LatLng>(isPublicPlanner ? PUBLIC_DEFAULT_CENTER : DEFAULT_CENTER);
  const [polygon, setPolygon] = useState<LatLng[]>(isPublicPlanner ? [] : DEFAULT_POLYGON);
  const [polygonSource, setPolygonSource] = useState<PolygonSource>("postal_code");
  const [areaSegments, setAreaSegments] = useState<OrderAreaSegmentDraft[]>(isPublicPlanner ? [] : [{
    id: "segment-default",
    name: "Koblenz Zentrum",
    city: "Koblenz",
    postalCode: "56068",
    district: "",
    country: "DE",
    points: DEFAULT_POLYGON,
    polygonSource: "postal_code",
  }]);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(isPublicPlanner ? null : "segment-default");
  const [pendingLocation, setPendingLocation] = useState<LocationResult | null>(null);
  const [, setHistory] = useState<LatLng[][]>(isPublicPlanner ? [] : [DEFAULT_POLYGON]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [flyerQuantity, setFlyerQuantity] = useState(isPublicPlanner ? 500 : 10_000);
  const [flyerQuantityTouched, setFlyerQuantityTouched] = useState(false);
  const [productFormat, setProductFormat] = useState(productOptions[0].value);
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
  const [areaSelectionMode, setAreaSelectionMode] = useState<"boundary" | "draw">("boundary");
  const [selectedBoundaryPlaceIds, setSelectedBoundaryPlaceIds] = useState<string[]>([]);
  const [mapNotice, setMapNotice] = useState("");
  const [usedAutocomplete, setUsedAutocomplete] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState<"local" | "updating" | "live" | "error">("local");
  const [draftStatus, setDraftStatus] = useState("Entwurf wird vorbereitet");
  const [finishStatus, setFinishStatus] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [overviewOffset, setOverviewOffset] = useState({ x: 0, y: 0 });
  const mapsBrowserKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  const mapsBoundaryMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "";
  const mapsBoundaryConfigured = Boolean(mapsBoundaryMapId);

  useEffect(() => {
    areaSegmentsRef.current = areaSegments;
  }, [areaSegments]);

  useEffect(() => {
    selectedBoundaryPlaceIdsRef.current = selectedBoundaryPlaceIds;
  }, [selectedBoundaryPlaceIds]);

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
  const perimeterMeters = useMemo(
    () => areaSegmentsPayload.reduce((sum, segment) => sum + polygonPerimeterMeters(segment.points), 0),
    [areaSegmentsPayload],
  );
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
  const netPrice = intelligence?.metrics.netPrice ?? "0";
  const vatAmount = intelligence?.metrics.vatAmount ?? "0";
  const grossPrice = intelligence?.metrics.grossPrice ?? "0";
  const distributorNeed = intelligence?.metrics.distributorNeed ?? Math.max(1, Math.ceil(localRouteDurationMinutes / 240), Math.ceil(flyerQuantity / 3500));
  const recommendedFlyerQuantity = recommendedFlyersForHouseholds(households);
  const deliverabilityScore = intelligence?.metrics.score ?? null;
  const calculationConfidence = intelligence?.metrics.confidence ?? (intelligenceStatus === "live" ? "medium" : "low");
  const calculationSource = intelligence?.metrics.source ?? (intelligenceStatus === "live" ? "Gebietsdaten" : "lokale Gebietsschätzung");
  const householdCountSource = intelligence?.metrics.householdCountSource ?? (intelligenceStatus === "live" ? "area-density-formula" : "client-area-estimate");
  const pricingVersion = intelligence?.metrics.pricingVersion ?? "pricing-rule-pending";
  const intelligenceRequestQuery = useMemo(() => new URLSearchParams({
    city,
    postalCode,
    street,
    houseNumber,
    distributionAreaId: selectedAreaId,
    flyerQuantity: String(flyerQuantity),
    flyerSource,
    productFormat,
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
    houseNumber,
    localRouteDistanceMeters,
    perimeterMeters,
    postalCode,
    selectedAreaId,
    printDataStatus,
    productFormat,
    street,
    startDate,
    endDate,
  ]);
  const geoJson = useMemo(() => segmentsToGeoJson(areaSegmentsPayload), [areaSegmentsPayload]);
  const areaStats = useMemo(() => ({
    polygonSource,
    areaKm2: coverageAreaSqm / 1_000_000,
    householdCount: households,
    recommendedFlyerQuantity,
    pricePreview: netPrice,
    walkingDistanceKm: routeDistanceMeters / 1000,
    deliveryDurationMinutes: routeDurationMinutes,
    warehouseSuggestion: intelligence?.metrics.needsManualReview ? null : intelligence?.warehouse?.city ?? null,
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
    targetAreaName,
  ]);

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

  const selectBoundaryArea = useCallback((placeId: string) => {
    const area = areas.find((candidate) => candidate.googlePlaceId === placeId);
    if (!area) {
      setMapNotice("Dieses Gebiet ist noch nicht als FLYERO-Gebiet hinterlegt. Du kannst es zeichnen oder als Anfrage zur Prüfung senden.");
      return;
    }
    const points = featurePoints(area.geoJson);
    if (points.length < 3) {
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
  }, [areas]);

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

  // Restore customer draft once from localStorage before the user continues editing.
  useEffect(() => {
    try {
      const queryParameter = isPublicPlanner ? new URLSearchParams(window.location.search).get("query") : null;
      if (queryParameter) initialSearchRef.current = queryParameter;
      const rawDraft = window.localStorage.getItem(draftStorageKey) ?? (!isPublicPlanner ? window.localStorage.getItem(LEGACY_ORDER_DRAFT_KEY) : null);
      if (!rawDraft) {
        draftRestoredRef.current = true;
        setDraftStatus("Entwurf wird automatisch gespeichert");
        setDraftRestored(true);
        return;
      }
      const draft = JSON.parse(rawDraft) as OrderDraft;
      if (draft.activeStep && draft.activeStep >= 1 && draft.activeStep <= 6) setActiveStep(draft.activeStep);
      if (draft.query) setQuery(draft.query);
      if (draft.selectedAreaId) setSelectedAreaId(draft.selectedAreaId);
      if (draft.city) setCity(draft.city);
      if (draft.postalCode) setPostalCode(draft.postalCode);
      if (draft.street) setStreet(draft.street);
      if (draft.houseNumber) setHouseNumber(draft.houseNumber);
      if (draft.targetAreaName) setTargetAreaName(draft.targetAreaName);
      if (draft.center && Number.isFinite(draft.center.lat) && Number.isFinite(draft.center.lng)) setCenter(draft.center);
      if (Array.isArray(draft.areaSegments) && draft.areaSegments.length > 0) {
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
      } else if (Array.isArray(draft.polygon) && draft.polygon.length >= 3) {
        setPolygon(draft.polygon);
        setHistory([draft.polygon]);
      }
      if (draft.polygonSource) setPolygonSource(draft.polygonSource);
      if (draft.flyerQuantity) setFlyerQuantity(draft.flyerQuantity);
      if (typeof draft.flyerQuantityTouched === "boolean") setFlyerQuantityTouched(draft.flyerQuantityTouched);
      if (draft.productFormat) setProductFormat(draft.productFormat);
      if (draft.flyerSource) setFlyerSource(draft.flyerSource);
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
      const restoredPayload = JSON.stringify({ eventType: "DRAFT_RESTORED", city: draft.city, postalCode: draft.postalCode, source: isPublicPlanner ? "public-planner" : "customer-planner" });
      navigator.sendBeacon?.(experienceEndpoint, new Blob([restoredPayload], { type: "application/json" }));
    } catch {
      window.localStorage.removeItem(draftStorageKey);
      setDraftStatus("Entwurf wird automatisch gespeichert");
    } finally {
      draftRestoredRef.current = true;
      setDraftRestored(true);
    }
  }, [draftStorageKey, experienceEndpoint, isPublicPlanner, minimumStartDate]);

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
          if (draft.flyerSource) setFlyerSource(draft.flyerSource);
          if (draft.printDataStatus) setPrintDataStatus(draft.printDataStatus);
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
      polygonSource,
      areaSegments: areaSegmentsPayload,
      areaStats,
      flyerQuantity,
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
    };
    const persistedDraft = isPublicPlanner
      ? Object.fromEntries(Object.entries(draft).filter(([key]) => !["contactPerson", "contactPhone", "notes"].includes(key)))
      : draft;
    window.localStorage.setItem(draftStorageKey, JSON.stringify(persistedDraft));
    setDraftStatus("Entwurf gespeichert");
  }, [
    activeStep,
    areaStats,
    areaSegmentsPayload,
    center,
    city,
    contactPerson,
    contactPhone,
    distributionType,
    endDate,
    flexibleScheduling,
    flyerQuantityTouched,
    flyerQuantity,
    flyerSource,
    houseNumber,
    notes,
    polygon,
    polygonSource,
    postalCode,
    printDataStatus,
    productFormat,
    query,
    selectedAreaId,
    startDate,
    street,
    targetAreaName,
    targetGroup,
    draftStorageKey,
    isPublicPlanner,
  ]);

  const applyLocationResult = useCallback((result: LocationResult, options?: { forceReplace?: boolean }) => {
    if (options?.forceReplace) {
      forceLocationReplaceRef.current = true;
      window.setTimeout(() => {
        forceLocationReplaceRef.current = false;
      }, 900);
    }
    if (polygonSource === "manual" && !options?.forceReplace) {
      setPendingLocation(result);
      return;
    }
    setIntelligence(null);
    setIntelligenceStatus("updating");
    if (result.city) setCity(result.city);
    if (result.postalCode) setPostalCode(result.postalCode);
    if (result.street) setStreet(result.street);
    if (result.houseNumber) setHouseNumber(result.houseNumber);
    if (result.label) setQuery(result.label);
    const nextCenter = { lat: Number(result.lat), lng: Number(result.lng) };
    if (Number.isFinite(nextCenter.lat) && Number.isFinite(nextCenter.lng)) {
      const matchedArea = findAreaForLocation(result);
      if (matchedArea?.points.length) {
        const matchedCenter = areaCenter(matchedArea.area, nextCenter);
        setCenter(matchedCenter);
        setSelectedAreaId(matchedArea.area.id);
        setTargetAreaName(matchedArea.area.name);
        pushPolygon(matchedArea.points, "saved_area");
        if (!flyerQuantityTouched && matchedArea.area.estimatedFlyers) setFlyerQuantity(matchedArea.area.estimatedFlyers);
      } else {
        setCenter(nextCenter);
        setSelectedAreaId("");
        setTargetAreaName(result.city ? `${result.postalCode ? `${result.postalCode} ` : ""}${result.city}` : "Verteilgebiet");
        if (isPublicPlanner) {
          setPolygon([]);
          setPolygonSource("postal_code");
          setHistory([]);
          setHistoryIndex(0);
          setMapNotice("Gebiet gefunden. Zeichne jetzt den gewünschten Bereich direkt auf der Karte.");
        } else {
          pushPolygon(polygonAroundCenter(nextCenter), "postal_code");
        }
        setFlyerQuantityTouched(false);
      }
    }
    setPendingLocation(null);
  }, [findAreaForLocation, flyerQuantityTouched, isPublicPlanner, polygonSource, pushPolygon]);

  const geocodeAddress = useCallback((input?: string) => {
    const currentQuery = input ?? searchInputRef.current?.value ?? query;
    const params = new URLSearchParams({
      q: currentQuery,
      city,
      postalCode,
      street,
      houseNumber,
    });
    fetch(`${geocodeEndpoint}?${params.toString()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const result = payload?.data;
        if (!result) {
          setMapNotice("Diese Adresse wurde nicht gefunden. Bitte prüfe die Eingabe oder zeichne das Gebiet direkt auf der Karte.");
          return;
        }
        if (isPublicPlanner) {
          void fetch(experienceEndpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ eventType: "LOCATION_SEARCH_COMPLETED", city: result.city, postalCode: result.postalCode, usedAutocomplete }),
          });
        }
        applyLocationResult(result, { forceReplace: forceLocationReplaceRef.current });
      })
      .catch(() => undefined);
  }, [applyLocationResult, city, experienceEndpoint, geocodeEndpoint, houseNumber, isPublicPlanner, postalCode, query, street, usedAutocomplete]);

  useEffect(() => {
    if (!isPublicPlanner || !draftRestored || !draftRestoredRef.current || !initialSearchRef.current) return;
    const initialQuery = initialSearchRef.current;
    initialSearchRef.current = null;
    setQuery(initialQuery);
    const timer = window.setTimeout(() => geocodeAddress(initialQuery), 0);
    return () => window.clearTimeout(timer);
  }, [draftRestored, geocodeAddress, isPublicPlanner]);

  const fetchSuggestions = useMemo(() => debounce((value: string) => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    fetch(`${autocompleteEndpoint}?q=${encodeURIComponent(value)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setSuggestions(payload?.data ?? []))
      .catch(() => setSuggestions([]));
  }, 220), [autocompleteEndpoint]);

  useEffect(() => {
    fetchSuggestions(query);
  }, [fetchSuggestions, query]);

  useEffect(() => {
    if (lastIntelligenceRequestRef.current === intelligenceRequestQuery) {
      return;
    }
    lastIntelligenceRequestRef.current = intelligenceRequestQuery;
    confirmedIntelligenceRequestRef.current = null;
    intelligenceAbortRef.current?.abort();
    const controller = new AbortController();
    intelligenceAbortRef.current = controller;
    setIntelligence(null);
    setIntelligenceStatus("updating");
    startTransition(() => {
      fetch(`${intelligenceEndpoint}?${intelligenceRequestQuery}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (lastIntelligenceRequestRef.current !== intelligenceRequestQuery) return;
          if (payload?.data) {
            setIntelligence(payload.data);
            confirmedIntelligenceRequestRef.current = intelligenceRequestQuery;
            setIntelligenceStatus("live");
          } else {
            setIntelligenceStatus("error");
          }
        })
        .catch((error) => {
          if (lastIntelligenceRequestRef.current === intelligenceRequestQuery && error?.name !== "AbortError") {
            setIntelligenceStatus("error");
          }
        });
    });
    return () => controller.abort();
  }, [intelligenceEndpoint, intelligenceRequestQuery]);

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
    if (!polygonRef.current && polygon.length >= 3) {
      try {
        polygonRef.current = new maps.Polygon({
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
        attachPolygonListeners(polygonRef.current);
      } catch {
        polygonRef.current = null;
      }
    }
    if (!drawingManagerRef.current && maps.drawing && mapRef.current) {
      let drawingManager: GoogleDrawingManager | null = null;
      try {
        drawingManager = new maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: false,
          polygonOptions: {
            strokeColor: "#a7ff00",
            strokeOpacity: 1,
            strokeWeight: 3,
            fillColor: "#1f7aff",
            fillOpacity: 0.28,
            editable: true,
            draggable: true,
          },
        });
        drawingManager.setMap(mapRef.current);
        drawingManagerRef.current = drawingManager;
      } catch {
        drawingManagerRef.current = null;
      }
      if (!drawingManager) return () => {
        isActive = false;
      };
      const onPolygonComplete = (overlay?: unknown) => {
        if (!overlay) return;
        const nextPolygon = overlay as GooglePolygon;
        try {
          polygonRef.current?.setMap(null);
          polygonRef.current = nextPolygon;
          polygonRef.current.setMap(mapRef.current);
          drawingManagerRef.current?.setDrawingMode(null);
        } catch {
          return;
        }
        let next: LatLng[] = [];
        try {
          next = pathToPoints(nextPolygon.getPath());
        } catch {
          return;
        }
        if (next.length >= 3) {
          const segmentId = activeSegmentId ?? `segment-${Date.now()}`;
          if (!activeSegmentId) {
            setActiveSegmentId(segmentId);
            setAreaSegments((current) => [...current, {
              id: segmentId,
              name: targetAreaName || [postalCode, city].filter(Boolean).join(" ") || "Verteilgebiet",
              city,
              postalCode,
              district: "",
              country: "DE",
              points: next,
              polygonSource: "drawn",
            }]);
          }
          setPolygon(next);
          setPolygonSource("drawn");
        }
        attachPolygonListeners(nextPolygon);
      };
      if (!drawingManagerListenerRef.current) {
        try {
          const handle = typeof drawingManager.addListener === "function"
            ? drawingManager.addListener("polygoncomplete", onPolygonComplete)
            : maps.event.addListener(drawingManager, "polygoncomplete", onPolygonComplete);
          if (handle) drawingManagerListenerRef.current = handle;
        } catch {
          drawingManagerListenerRef.current = null;
        }
      }
    }
    return () => {
      isActive = false;
    };
  }, [activeSegmentId, center, city, mapMode, mapsBoundaryMapId, mapsReady, polygon, postalCode, targetAreaName]);

  useEffect(() => {
    if (!mapsReady || !mapsBoundaryConfigured || !mapRef.current || !window.google?.maps?.FeatureType) return;
    const maps = window.google.maps;
    const installBoundaryLayers = () => {
      if (!mapRef.current?.getFeatureLayer) return;
      const featureTypes = [
        maps.FeatureType?.POSTAL_CODE ?? "POSTAL_CODE",
        maps.FeatureType?.LOCALITY ?? "LOCALITY",
      ];
      for (const featureType of featureTypes) {
        if (boundaryLayerRefs.current.has(featureType)) continue;
        let layer: GoogleFeatureLayer;
        try {
          layer = mapRef.current.getFeatureLayer(featureType);
        } catch {
          continue;
        }
        if (!layer || layer.isAvailable === false) continue;
        layer.style = boundaryLayerStyle(selectedBoundaryPlaceIdsRef.current);
        boundaryLayerRefs.current.set(featureType, layer);
        const listener = layer.addListener?.("click", (event) => {
          const placeId = event.features?.[0]?.placeId;
          if (placeId) selectBoundaryAreaRef.current(placeId);
        });
        if (listener) boundaryLayerListenersRef.current.push(listener);
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
  }, [mapsBoundaryConfigured, mapsReady]);

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
        drawingManagerListenerRef.current?.remove?.();
      } catch {
        // Google may already have disposed the drawing manager.
      }
      drawingManagerListenerRef.current = null;
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
    if (!mapsReady || !mapRef.current || !polygonRef.current || !window.google?.maps) return;
    mapRef.current.setMapTypeId(mapMode === "satellite" ? "satellite" : "roadmap");
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(street ? 16 : 14);
    polygonRef.current.setPath(polygon);
    if (polygon.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    areaSegmentsPayload.forEach((segment) => segment.points.forEach((point) => bounds.extend(point)));
    mapRef.current.fitBounds(bounds);
  }, [areaSegmentsPayload, center, mapMode, mapsReady, polygon, street]);

  function applySuggestion(suggestion: Suggestion) {
    setUsedAutocomplete(true);
    setShowSuggestions(false);
    setSuggestions([]);
    if (suggestion.lat && suggestion.lng) {
      applyLocationResult({
        city: suggestion.city,
        postalCode: suggestion.postalCode,
        street: suggestion.street,
        label: suggestion.label,
        lat: suggestion.lat,
        lng: suggestion.lng,
      });
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

  function moveQuantity(delta: number) {
    setFlyerQuantityTouched(true);
    setFlyerQuantity((value) => Math.max(500, Math.min(250_000, value + delta)));
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
    const drawing = window.google?.maps.drawing;
    if (!mapsReady || !drawingManagerRef.current || !drawing) {
      setMapNotice(
        mapsBrowserKeyConfigured
          ? "Die Karte lädt noch. Bitte kurz warten und erneut versuchen."
          : "Die Karte ist gerade nicht verfügbar. Du kannst die Anfrage trotzdem senden oder FLYERO bespricht das Gebiet mit dir.",
      );
      return;
    }
    setMapNotice("Klicke auf der Karte die Eckpunkte deines Gebiets. Zum Abschließen den ersten Punkt wieder anklicken.");
    drawingManagerRef.current.setDrawingMode(drawing.OverlayType.POLYGON);
  }

  function trackSubmit(options?: { clearDraft?: boolean; handoffToCustomer?: boolean; eventType?: string; orderId?: string }) {
    if (options?.clearDraft !== false) window.localStorage.removeItem(draftStorageKey);
    if (isPublicPlanner && options?.handoffToCustomer) {
      const publicDraft = window.localStorage.getItem(PUBLIC_ORDER_DRAFT_KEY);
      if (publicDraft) window.localStorage.setItem(ORDER_DRAFT_KEY, publicDraft);
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
        metadata: { mapMode, productFormat, targetGroup, distributionType, plannerMode: mode, segmentCount: areaSegmentsPayload.length },
      }),
    });
  }

  function buildOrderPayload(completionPath: "direct_payment" | "inquiry") {
    return {
      serviceType: "FLYER_DISTRIBUTION",
      city,
      postalCode,
      street,
      houseNumber,
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
      productFormat,
      printDataStatus,
      completionPath,
      preferredStartDate: startDate,
      preferredEndDate: endDate,
      flexibleScheduling,
      contactPerson,
      contactPhone,
      notes: `${notes}${notes ? "\n" : ""}Produkt: ${productFormat}. Zielgruppe: ${targetGroup}. Verteilung: ${distributionType}.`,
      quoteFingerprint: intelligence?.metrics.fingerprint ?? "",
    };
  }

  async function finishOrder(completionPath: "direct_payment" | "inquiry") {
    if (isFinishing) return;
    if (!isPublicPlanner && (
      intelligenceStatus !== "live" ||
      confirmedIntelligenceRequestRef.current !== intelligenceRequestQuery ||
      !intelligence?.metrics.fingerprint
    )) {
      setFinishStatus("Preis wird aktualisiert. Bitte bestätige die aktuelle Planung erneut.");
      return;
    }
    setIsFinishing(true);
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
          window.localStorage.removeItem(ORDER_DRAFT_KEY);
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

      window.localStorage.removeItem(ORDER_DRAFT_KEY);
      setFinishStatus("Deine Anfrage wurde übermittelt. Wir prüfen Gebiet, Druck und Preis und melden uns schnell.");
      window.location.href = `/customer/orders/${orderResult.data.id}?inquiry=success`;
    } catch (error) {
      setFinishStatus(error instanceof Error ? error.message : "Die Anfrage konnte nicht abgeschlossen werden.");
    } finally {
      setIsFinishing(false);
    }
  }

  const stepState = [
    { id: 1, title: "Gebiet", detail: "Wo soll verteilt werden?", value: coverageAreaSqm > 0 ? `${(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²` : "Noch offen" },
    { id: 2, title: "Flyer", detail: "Format, Menge und Druck", value: `${formatNumber(flyerQuantity)} Stück` },
    { id: 3, title: "Verteilung", detail: "Art und wichtige Hinweise", value: distributionType === "Haushaltsverteilung" ? "Haushalte" : distributionType },
    { id: 4, title: "Zeitraum", detail: `Frühester Start ab ${formatShortDate(minimumStartDate)}`, value: formatShortDate(startDate) },
    { id: 5, title: "Preis prüfen", detail: "Gebiet, Preis und Leistungen", value: Number(netPrice) > 0 ? formatCurrency(netPrice) : "Noch offen" },
    { id: 6, title: "Abschluss", detail: "Buchen, anfragen oder Formular senden", value: "3 Wege" },
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
    if (stepId === 1) {
      return (
        <section className="orderPanelBlock primary inlineStepBlock">
          <p className="orderStepHint">Gib eine Adresse oder PLZ ein. Danach kannst du das Gebiet direkt auf der Karte anpassen.</p>
          <label>
            PLZ, Ort oder Adresse
            <div className="searchInputShell">
              <input
                value={query}
                ref={searchInputRef}
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
              <button type="button" onClick={() => geocodeAddress(searchInputRef.current?.value)} aria-label="Adresse suchen"><Search aria-hidden="true" /></button>
            </div>
          </label>
          <div className="selectedLocationBar">
            <strong>{city ? `${postalCode} ${city}` : "Noch kein Gebiet gewählt"}</strong>
            <span>{street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : "Die Grenzen kannst du danach direkt auf der Karte anpassen."}</span>
          </div>
          {pendingLocation ? (
            <div className="replaceAreaNotice" role="alert">
              <strong>Dein Gebiet wurde auf der Karte angepasst.</strong>
              <p>Wenn du eine neue PLZ übernimmst, ersetzt sie dein aktuelles Gebiet.</p>
              <div>
                <button type="button" onClick={() => applyLocationResult(pendingLocation, { forceReplace: true })}>Neues Gebiet übernehmen</button>
                <button type="button" onClick={keepCurrentArea}>Aktuelles Gebiet behalten</button>
              </div>
            </div>
          ) : null}
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
          <div className="modeTabs areaSelectionTabs">
            <button
              type="button"
              className={areaSelectionMode === "boundary" && mapsBoundaryConfigured ? "selected" : ""}
              disabled={!mapsBoundaryConfigured}
              onClick={() => {
                setAreaSelectionMode("boundary");
                drawingManagerRef.current?.setDrawingMode(null);
                setMapNotice("Klicke auf eine markierte PLZ- oder Stadtfläche, um sie auszuwählen.");
              }}
            >
              Gebiet auswählen
            </button>
            <button type="button" className={areaSelectionMode === "draw" || !mapsBoundaryConfigured ? "selected" : ""} onClick={startDrawingArea}>
              Eigenes Gebiet zeichnen
            </button>
          </div>
          <small className="orderSegmentHint">
            {mapsBoundaryConfigured
              ? "Wähle eine markierte PLZ- oder Stadtfläche oder zeichne dein Gebiet selbst."
              : "Du kannst dein Gebiet direkt zeichnen. Die Auswahl fertiger PLZ- und Stadtflächen wird nach der Kartenfreigabe aktiviert."}
          </small>
          <div className="savedAreaMini">
            <div>
              <span>Dein Verteilgebiet</span>
              <strong>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</strong>
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
                <button type="button" onClick={() => selectSegment(segment)}>
                  <span className="orderSegmentIndex">{index + 1}</span>
                  <span>
                    <strong>{segment.name || `Teilgebiet ${index + 1}`}</strong>
                    <small>{[segment.postalCode, segment.city].filter(Boolean).join(" ") || "Noch nicht festgelegt"}</small>
                  </span>
                </button>
                <button type="button" className="orderSegmentRemove" onClick={() => removeSegment(segment.id)} disabled={areaSegments.length <= 1} aria-label={`${segment.name || "Teilgebiet"} entfernen`}>Entfernen</button>
              </div>
            ))}
            <button type="button" className="orderSegmentAdd" onClick={addSegment}>Teilgebiet hinzufügen</button>
            <small className="orderSegmentHint">Mehrere Orte und Stadtteile bleiben getrennt sichtbar und werden gemeinsam geplant.</small>
          </div>
        </section>
      );
    }

    if (stepId === 2) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <p className="orderStepHint">Wähle Format und Menge. Danach entscheidest du, ob FLYERO den Druck übernimmt.</p>
          <label>
            Flyerformat
            <select value={productFormat} onChange={(event) => setProductFormat(event.target.value)}>
              {productOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <div className="modeTabs flyerSourceTabs">
            <button type="button" className={flyerSource === "CUSTOMER_OWN" ? "selected" : ""} onClick={() => {
              setFlyerSource("CUSTOMER_OWN");
              setPrintDataStatus("UPLOAD_LATER");
            }}>Flyer sind vorhanden</button>
            <button type="button" className={flyerSource === "PRINT_SERVICE" ? "selected" : ""} onClick={() => {
              setFlyerSource("PRINT_SERVICE");
              setPrintDataStatus("PRINT_REQUESTED");
            }}>Druck über FLYERO</button>
          </div>
          <div className="modeTabs flyerSourceTabs">
            <button type="button" className={printDataStatus === "UPLOADED" ? "selected" : ""} onClick={() => setPrintDataStatus("UPLOADED")}>Datei ist bereit</button>
            <button type="button" className={printDataStatus === "UPLOAD_LATER" ? "selected" : ""} onClick={() => setPrintDataStatus("UPLOAD_LATER")}>Datei später senden</button>
          </div>
          <div className="flyerRecommendation">
            <span>Unser Vorschlag</span>
            <strong>{formatNumber(recommendedFlyerQuantity)} Flyer mit 10 % Reserve</strong>
            <small>Du kannst die Menge jederzeit ändern.</small>
          </div>
          <div className="quantityControl">
            <button type="button" onClick={() => moveQuantity(-1000)}>−</button>
            <input
              value={flyerQuantity}
              onChange={(event) => {
                setFlyerQuantityTouched(true);
                setFlyerQuantity(Number(event.target.value) || 0);
              }}
              inputMode="numeric"
            />
            <button type="button" onClick={() => moveQuantity(1000)}>+</button>
            <span>Stück</span>
          </div>
        </section>
      );
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
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <p className="orderStepHint">Wähle deinen Zeitraum. Der früheste Start ist sieben Tage nach deiner Buchung.</p>
          <div className="dateGrid">
            <label>Frühester möglicher Start<input type="date" min={minimumStartDate} value={startDate} onChange={(event) => {
              const nextStartDate = clampIsoDate(event.target.value, minimumStartDate);
              setStartDate(nextStartDate);
              if (endDate < nextStartDate) setEndDate(nextStartDate);
            }} /></label>
            <label>Spätestes Zustelldatum<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(clampIsoDate(event.target.value, startDate))} /></label>
          </div>
          <label className="checkLine">
            <input type="checkbox" checked={flexibleScheduling} onChange={(event) => setFlexibleScheduling(event.target.checked)} />
            Zeitraum flexibel abstimmen
          </label>
        </section>
      );
    }

    if (stepId === 5) {
      return (
        <section className="orderPanelBlock inlineStepBlock">
          <div className="summaryMiniGrid">
            <span><strong>{postalCode} {city}</strong>Gebiet</span>
            <span><strong>{formatNumber(households)}</strong>Haushalte geschätzt</span>
            <span><strong>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</strong>Fläche</span>
            <span><strong>{formatNumber(flyerQuantity)}</strong>Flyer</span>
            <span><strong>{intelligence ? formatCurrency(netPrice) : "wird berechnet"}</strong>Preis netto</span>
            <span><strong>{intelligence ? formatCurrency(vatAmount) : "wird berechnet"}</strong>Umsatzsteuer</span>
            <span className="summaryTotal"><strong>{intelligence ? formatCurrency(grossPrice) : "wird berechnet"}</strong>Gesamt brutto</span>
            <span><strong>{areaStats.warehouseSuggestion ?? "wird geprüft"}</strong>Nächstes Lager</span>
          </div>
          <p className="orderReviewNotice">Nach der Zahlung prüfen wir Gebiet, Druckdatei und ob die Verteilung wie geplant möglich ist. Falls sich etwas ändert, melden wir uns.</p>
          <p className="overviewDataBasis">{confidenceLabel(areaStats.confidence)}</p>
          <div className="proofIncludedList">
            <span>GPS-Nachweis nach der Verteilung</span>
            <span>Foto-Dokumentation nach der Verteilung</span>
            <span>PDF-Bericht nach Abschluss</span>
          </div>
          <details className="orderDetails inlineDetails">
            <summary>Kontakt & Hinweise</summary>
            <label>Kontaktperson<input value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} /></label>
            <label>Telefon<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
            <label>Hinweise<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          </details>
        </section>
      );
    }

    return (
      <section className="orderPanelBlock inlineStepBlock">
        <p className="orderStepHint">Wähle, wie du fortfahren möchtest. Eine Anfrage ist unverbindlich und löst keine Zahlung aus.</p>
        <div className="orderFinishChoices">
          <button type="button" className="finishPrimary" disabled={isFinishing} onClick={() => finishOrder("direct_payment")}>
            Jetzt buchen und bezahlen
            <small>Buchung anlegen und sicher zur Zahlung weitergehen.</small>
          </button>
          <button type="button" disabled={isFinishing} onClick={() => finishOrder("inquiry")}>
            Unverbindlich anfragen
            <small>Wir prüfen Gebiet, Druck und Preis und melden uns schnell.</small>
          </button>
          <a href={inquiryFormHref} download>
            <Download aria-hidden="true" />
            Anfrageformular herunterladen
          </a>
          <a href={inquiryMailHref}>
            <Mail aria-hidden="true" />
            Per E-Mail anfragen
          </a>
        </div>
        <p className="orderReviewNotice">Nach der Verteilung erhältst du GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.</p>
        {finishStatus ? <p className="finishStatus" role="status">{finishStatus}</p> : null}
      </section>
    );
  }

  return (
    <form
      className="orderExperience"
      onClick={() => setClickCount((value) => value + 1)}
      onSubmit={(event) => event.preventDefault()}
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
      <input type="hidden" name="productFormat" value={productFormat} />
      <input type="hidden" name="printDataStatus" value={printDataStatus} />
      <input type="hidden" name="preferredStartDate" value={startDate} />
      <input type="hidden" name="preferredEndDate" value={endDate} />
      <input type="hidden" name="flexibleScheduling" value={flexibleScheduling ? "true" : "false"} />
      <input type="hidden" name="contactPerson" value={contactPerson} />
      <input type="hidden" name="contactPhone" value={contactPhone} />
      <input type="hidden" name="notes" value={`${notes}${notes ? "\n" : ""}Produkt: ${productFormat}. Zielgruppe: ${targetGroup}.`} />

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
          <span>Preis netto zzgl. MwSt.</span>
          <strong>{Number(netPrice) > 0 ? formatCurrency(netPrice) : "wird berechnet"}</strong>
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
        <div ref={mapElementRef} className="orderGoogleMap" aria-hidden={!mapsReady} />
        {!mapsReady ? <MiniMapFallback /> : null}
        {!mapsReady ? (
          <div className="mapConfigNotice" role="status">
            <strong>{mapsBrowserKeyConfigured ? "Karte wird geladen" : "Karte gerade nicht verfügbar"}</strong>
            <span>
              {mapsBrowserKeyConfigured
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
              {syncStateLabel(intelligenceStatus, areaStats.confidence, isPending)}
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
            <p className="overviewDataBasis">{confidenceLabel(areaStats.confidence)}</p>
            {overviewOffset.x !== 0 || overviewOffset.y !== 0 ? (
              <button type="button" onClick={() => setOverviewOffset({ x: 0, y: 0 })}>Zurücksetzen</button>
            ) : null}
          </div>
          <dl>
            <div><dt>Fläche</dt><dd>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</dd></div>
            <div><dt>Empfohlene Flyerzahl</dt><dd>{formatNumber(recommendedFlyerQuantity)} Flyer</dd></div>
            <div><dt>Preis netto zzgl. MwSt.</dt><dd>{Number(netPrice) > 0 ? formatCurrency(netPrice) : "wird berechnet"}</dd></div>
            <div><dt>Nächstes Lager</dt><dd>{areaStats.warehouseSuggestion ?? "wird geprüft"}</dd></div>
          </dl>
          <p className="availabilityGood">{deliverabilityLabel(deliverabilityScore)}</p>
        </aside>
      </section>
    </form>
  );
}


