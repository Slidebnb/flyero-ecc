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
  Plus,
  ReceiptText,
  Search,
} from "lucide-react";
import type { ReusableAreaOption } from "@/app/components/DistributionAreaEditor";

type LatLng = { lat: number; lng: number };
type PolygonSource = "postal_code" | "manual" | "saved_area" | "drawn";
type OverviewDragState = { pointerId: number; startX: number; startY: number; baseX: number; baseY: number };

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
    source?: string;
    confidence?: "high" | "medium" | "low";
    calculatedAt?: string;
    calculationVersion?: string;
    householdCountSource?: string;
    pricingVersion?: string;
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
  polygonSource?: PolygonSource;
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
  setMapTypeId: (mapTypeId: "roadmap" | "satellite") => void;
};
type GooglePolygon = {
  setMap: (map: GoogleMap | null) => void;
  setPath: (path: LatLng[]) => void;
  getPath: () => GooglePath;
};
type GoogleDrawingManager = {
  setMap: (map: GoogleMap | null) => void;
  setDrawingMode: (mode: string | null) => void;
};
type GoogleNamespace = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
    Polygon: new (options: Record<string, unknown>) => GooglePolygon;
    LatLngBounds: new () => { extend: (point: LatLng) => void };
    event: { addListener: (target: unknown, eventName: string, callback: (event?: unknown) => void) => void };
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
  if (confidence === "high") return "Datenbasis: geprüfte Importdaten";
  if (confidence === "medium") return "Datenbasis: berechnet aus verfügbaren Gebietsdaten";
  return "Datenbasis: wird nach Prüfung bestätigt";
}

function syncStateLabel(status: "local" | "updating" | "live" | "error", confidence?: "high" | "medium" | "low", pending?: boolean) {
  if (status === "updating" || pending) return "Wird aktualisiert";
  if (status === "live" && confidence === "high") return "Geprüft berechnet";
  if (status === "live") return "Berechnet aus Gebietsdaten";
  if (status === "error") return "Geschätzt";
  return "Geschätzt";
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

function clampOverviewOffset(x: number, y: number) {
  return {
    x: Math.max(-560, Math.min(80, x)),
    y: Math.max(-360, Math.min(120, y)),
  };
}

function deliverabilityLabel(score?: number | null) {
  if (!Number.isFinite(score ?? NaN)) return "Verteilbarkeit wird geprüft";
  if ((score ?? 0) >= 82) return "Sehr gute Verteilbarkeit";
  if ((score ?? 0) >= 65) return "Gute Verteilbarkeit";
  if ((score ?? 0) >= 45) return "Prüfung empfohlen";
  return "Schwieriges Gebiet";
}

function loadGoogleMaps() {
  const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!browserKey || typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps) return Promise.resolve(true);
  if (!window.__flyeroMapsLoading) {
    window.__flyeroMapsLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&v=3.64&libraries=drawing,geometry,places`;
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
  const forceLocationReplaceRef = useRef(false);
  const lastIntelligenceRequestRef = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const polygonRef = useRef<GooglePolygon | null>(null);
  const drawingManagerRef = useRef<GoogleDrawingManager | null>(null);
  const overviewDragRef = useRef<OverviewDragState | null>(null);
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
  const [polygonSource, setPolygonSource] = useState<PolygonSource>("postal_code");
  const [pendingLocation, setPendingLocation] = useState<LocationResult | null>(null);
  const [, setHistory] = useState<LatLng[][]>([DEFAULT_POLYGON]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [flyerQuantity, setFlyerQuantity] = useState(10_000);
  const [flyerQuantityTouched, setFlyerQuantityTouched] = useState(false);
  const [productFormat, setProductFormat] = useState(productOptions[0].value);
  const [flyerSource, setFlyerSource] = useState("CUSTOMER_OWN");
  const [printDataStatus, setPrintDataStatus] = useState("UPLOAD_LATER");
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
  const [heatmapNotice, setHeatmapNotice] = useState("");
  const [usedAutocomplete, setUsedAutocomplete] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState<"local" | "updating" | "live" | "error">("local");
  const [draftStatus, setDraftStatus] = useState("Entwurf wird vorbereitet");
  const [finishStatus, setFinishStatus] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);
  const [overviewOffset, setOverviewOffset] = useState({ x: 0, y: 0 });
  const mapsBrowserKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);

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
  const netPrice = intelligence?.metrics.netPrice ?? "0";
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
    coverageAreaSqm: String(coverageAreaSqm),
    distanceMeters: String(localRouteDistanceMeters),
    perimeterMeters: String(perimeterMeters),
  }).toString(), [
    city,
    coverageAreaSqm,
    flyerQuantity,
    houseNumber,
    localRouteDistanceMeters,
    perimeterMeters,
    postalCode,
    selectedAreaId,
    street,
  ]);
  const geoJson = useMemo(() => polygonToGeoJson(polygon), [polygon]);
  const areaStats = useMemo(() => ({
    polygonSource,
    areaKm2: coverageAreaSqm / 1_000_000,
    householdCount: households,
    recommendedFlyerQuantity,
    pricePreview: netPrice,
    walkingDistanceKm: routeDistanceMeters / 1000,
    deliveryDurationMinutes: routeDurationMinutes,
    warehouseSuggestion: intelligence?.warehouse?.city ?? null,
    distributorDemand: distributorNeed,
    deliverabilityScore,
    source: calculationSource,
    confidence: calculationConfidence,
    calculatedAt: intelligence?.metrics.calculatedAt ?? new Date().toISOString(),
    calculationVersion: intelligence?.metrics.calculationVersion ?? "client-area-estimate-v1",
    householdCountSource,
    pricingVersion,
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
    polygonSource,
    postalCode,
    pricingVersion,
    selectedAreaId,
    recommendedFlyerQuantity,
    routeDistanceMeters,
    routeDurationMinutes,
    targetAreaName,
  ]);

  const smartAreas = useMemo(() => {
    const intelligenceAreas = intelligence?.suggestions?.length ? intelligence.suggestions : [];
    const needle = `${city} ${postalCode} ${query}`.toLowerCase();
    const local = areas.filter((area) => {
      const haystack = `${area.name} ${area.city ?? ""} ${area.postalCode ?? ""} ${area.district ?? ""}`.toLowerCase();
      return haystack.includes(city.toLowerCase()) || haystack.includes(postalCode.slice(0, 3)) || needle.includes((area.city ?? "").toLowerCase());
    });
    return [...intelligenceAreas, ...local].filter((area, index, list) => list.findIndex((item) => item.id === area.id) === index).slice(0, 4);
  }, [areas, city, intelligence, postalCode, query]);

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

  const pushPolygon = useCallback((next: LatLng[], source: PolygonSource = "drawn") => {
    setPolygon(next);
    setPolygonSource(source);
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
      if (draft.activeStep && draft.activeStep >= 1 && draft.activeStep <= 6) setActiveStep(draft.activeStep);
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
      if (draft.polygonSource) setPolygonSource(draft.polygonSource);
      if (draft.flyerQuantity) setFlyerQuantity(draft.flyerQuantity);
      if (typeof draft.flyerQuantityTouched === "boolean") setFlyerQuantityTouched(draft.flyerQuantityTouched);
      if (draft.productFormat) setProductFormat(draft.productFormat);
      if (draft.flyerSource) setFlyerSource(draft.flyerSource);
      if (draft.printDataStatus) setPrintDataStatus(draft.printDataStatus);
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
      polygonSource,
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
    window.localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
    setDraftStatus("Entwurf gespeichert");
  }, [
    activeStep,
    areaStats,
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
        pushPolygon(polygonAroundCenter(nextCenter), "postal_code");
        setFlyerQuantityTouched(false);
      }
    }
    setPendingLocation(null);
  }, [findAreaForLocation, flyerQuantityTouched, polygonSource, pushPolygon]);

  const geocodeAddress = useCallback((input?: string) => {
    const currentQuery = input ?? searchInputRef.current?.value ?? query;
    const params = new URLSearchParams({
      q: currentQuery,
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
        applyLocationResult(result, { forceReplace: forceLocationReplaceRef.current });
      })
      .catch(() => undefined);
  }, [applyLocationResult, city, houseNumber, postalCode, query, street]);

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
    if (lastIntelligenceRequestRef.current === intelligenceRequestQuery) {
      return;
    }
    lastIntelligenceRequestRef.current = intelligenceRequestQuery;
    setIntelligenceStatus("updating");
    startTransition(() => {
      fetch(`/api/maps/order-intelligence?${intelligenceRequestQuery}`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (lastIntelligenceRequestRef.current !== intelligenceRequestQuery) return;
          if (payload?.data) {
            setIntelligence(payload.data);
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
  }, [intelligenceRequestQuery]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const startedPayload = JSON.stringify({
      eventType: "WIZARD_STARTED",
      city,
      postalCode,
      source: "order-wizard-reference-redesign",
    });
    navigator.sendBeacon?.("/api/maps/experience", new Blob([startedPayload], { type: "application/json" }));
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
    const maps = window.google.maps;
    const syncPath = () => {
      const next = pathToPoints(polygonRef.current?.getPath() ?? { getLength: () => 0, getAt: () => ({ lat: () => 0, lng: () => 0 }), forEach: () => undefined });
      if (next.length >= 3) {
        setPolygon(next);
        setPolygonSource("manual");
      }
    };
    const attachPolygonListeners = (target: GooglePolygon) => {
      const path = target.getPath();
      maps.event.addListener(path, "set_at", syncPath);
      maps.event.addListener(path, "insert_at", syncPath);
      maps.event.addListener(path, "remove_at", syncPath);
      maps.event.addListener(target, "drag", syncPath);
      maps.event.addListener(target, "dragend", syncPath);
    };
    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapElementRef.current, {
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
    }
    if (!drawingManagerRef.current && maps.drawing && mapRef.current) {
      drawingManagerRef.current = new maps.drawing.DrawingManager({
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
      drawingManagerRef.current.setMap(mapRef.current);
      maps.event.addListener(drawingManagerRef.current, "polygoncomplete", (overlay) => {
        const nextPolygon = overlay as GooglePolygon;
        polygonRef.current?.setMap(null);
        polygonRef.current = nextPolygon;
        polygonRef.current.setMap(mapRef.current);
        drawingManagerRef.current?.setDrawingMode(null);
        const next = pathToPoints(nextPolygon.getPath());
        if (next.length >= 3) {
          setPolygon(next);
          setPolygonSource("drawn");
        }
        attachPolygonListeners(nextPolygon);
      });
    }
  }, [center, mapMode, mapsReady, polygon]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !polygonRef.current || !window.google?.maps) return;
    mapRef.current.setMapTypeId(mapMode === "satellite" ? "satellite" : "roadmap");
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(street ? 16 : 14);
    polygonRef.current.setPath(polygon);
    const bounds = new window.google.maps.LatLngBounds();
    polygon.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds);
  }, [center, mapMode, mapsReady, polygon, street]);

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

  function applyArea(area: ReusableAreaOption) {
    setIntelligence(null);
    setIntelligenceStatus("updating");
    setSelectedAreaId(area.id);
    setTargetAreaName(area.name);
    if (area.city) setCity(area.city);
    if (area.postalCode) setPostalCode(area.postalCode);
    if (area.centerLat && area.centerLng) setCenter({ lat: area.centerLat, lng: area.centerLng });
    const nextPoints = featurePoints(area.geoJson);
    if (nextPoints.length >= 3) pushPolygon(nextPoints, "saved_area");
    if (!flyerQuantityTouched && area.estimatedFlyers) setFlyerQuantity(area.estimatedFlyers);
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

  function requestHeatmap() {
    setShowHeatmap(false);
    setHeatmapNotice("Heatmap für dieses Gebiet noch nicht verfügbar.");
  }

  function startDrawingArea() {
    const drawing = window.google?.maps.drawing;
    if (!mapsReady || !drawingManagerRef.current || !drawing) {
      setHeatmapNotice(
        mapsBrowserKeyConfigured
          ? "Die Zeichenfunktion lädt noch. Bitte kurz warten und erneut versuchen."
          : "Die Live-Karte ist gerade nicht verfügbar. Sie können die Anfrage trotzdem senden oder FLYERO hilft bei der Gebietsauswahl.",
      );
      return;
    }
    setHeatmapNotice("Klicken Sie auf der Karte die Eckpunkte Ihres Gebiets. Zum Abschließen den ersten Punkt wieder anklicken.");
    drawingManagerRef.current.setDrawingMode(drawing.OverlayType.POLYGON);
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
      printDataStatus,
      completionPath,
      preferredStartDate: startDate,
      preferredEndDate: endDate,
      flexibleScheduling,
      contactPerson,
      contactPhone,
      notes: `${notes}${notes ? "\n" : ""}Produkt: ${productFormat}. Zielgruppe: ${targetGroup}. Verteilung: ${distributionType}.`,
    };
  }

  async function finishOrder(completionPath: "direct_payment" | "inquiry") {
    if (isFinishing) return;
    setIsFinishing(true);
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
        throw new Error(orderResult?.error || "Kampagne konnte nicht gespeichert werden.");
      }

      if (completionPath === "direct_payment") {
        const checkoutResponse = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: orderResult.data.id }),
        });
        const checkoutResult = await checkoutResponse.json();
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
      setFinishStatus("Deine Anfrage wurde übermittelt. Wir prüfen Gebiet, Druckdaten und Preis und melden uns schnellstmöglich.");
      window.location.href = `/customer/orders/${orderResult.data.id}?inquiry=success`;
    } catch (error) {
      setFinishStatus(error instanceof Error ? error.message : "Die Anfrage konnte nicht abgeschlossen werden.");
    } finally {
      setIsFinishing(false);
    }
  }

  const stepState = [
    { id: 1, title: "Gebiet wählen", detail: "Dieses markierte Gebiet wird für deine Verteilung verwendet", value: `${(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²` },
    { id: 2, title: "Flyer & Druck", detail: "Flyer, Druckdaten und Menge festlegen", value: `${formatNumber(flyerQuantity)} Stück` },
    { id: 3, title: "Verteilung & Hinweise", detail: "Verteilart, Zielgruppe und Hinweise", value: distributionType },
    { id: 4, title: "Zeitraum & Auslieferung", detail: "Bestimme Zeitraum und Auslieferung", value: startDate },
    { id: 5, title: "Zusammenfassung", detail: "Prüfe Gebiet, Preis und Nachweise", value: formatCurrency(netPrice) },
    { id: 6, title: "Abschluss", detail: "Buchen, anfragen oder klassisch senden", value: "3 Wege" },
  ];
  const orderNavGroups = Array.from(new Set(orderNavItems.map((item) => item.group)));

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
          <p className="orderStepHint">Dieses markierte Gebiet wird für deine Verteilung verwendet. Du kannst es auf der Karte jederzeit anpassen.</p>
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
            <strong>{postalCode} {city}</strong>
            <span>{street ? `${street}${houseNumber ? ` ${houseNumber}` : ""}` : "Gebiet wird direkt auf der Karte aktualisiert"}</span>
          </div>
          {pendingLocation ? (
            <div className="replaceAreaNotice" role="alert">
              <strong>Du hast dein Gebiet manuell angepasst.</strong>
              <p>Wenn du eine neue PLZ übernimmst, wird das aktuelle Gebiet ersetzt.</p>
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
          <div className="modeTabs">
            <button type="button" className="selected" onClick={startDrawingArea}>Gebiet zeichnen</button>
            <button type="button" onClick={() => setActiveStep(3)}>POI verwenden</button>
          </div>
          <div className="savedAreaMini">
            <div>
              <span>Gewähltes Gebiet</span>
              <strong>{(coverageAreaSqm / 1_000_000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km²</strong>
              <small>{polygonSourceLabel()}</small>
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
          <div className="modeTabs flyerSourceTabs">
            <button type="button" className={flyerSource === "CUSTOMER_OWN" ? "selected" : ""} onClick={() => {
              setFlyerSource("CUSTOMER_OWN");
              setPrintDataStatus("UPLOAD_LATER");
            }}>Flyer vorhanden</button>
            <button type="button" className={flyerSource === "PRINT_SERVICE" ? "selected" : ""} onClick={() => {
              setFlyerSource("PRINT_SERVICE");
              setPrintDataStatus("PRINT_REQUESTED");
            }}>Druck über FLYERO</button>
          </div>
          <div className="modeTabs flyerSourceTabs">
            <button type="button" className={printDataStatus === "UPLOADED" ? "selected" : ""} onClick={() => setPrintDataStatus("UPLOADED")}>Datei ist bereit</button>
            <button type="button" className={printDataStatus === "UPLOAD_LATER" ? "selected" : ""} onClick={() => setPrintDataStatus("UPLOAD_LATER")}>Datei später hochladen</button>
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
          <label>
            Hinweise an FLYERO
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="z. B. bestimmte Straßen auslassen, Gewerbegebiet bevorzugen, Zugangshinweise, wichtige Bemerkungen"
            />
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
            <label>Frühestmöglicher Start<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label>Spätestes Zustelldatum<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          </div>
          <label className="checkLine">
            <input type="checkbox" checked={flexibleScheduling} onChange={(event) => setFlexibleScheduling(event.target.checked)} />
            Wunschzeitraum flexibel abstimmen
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
            <span><strong>{formatCurrency(netPrice)}</strong>Preis netto zzgl. MwSt.</span>
            <span><strong>{areaStats.warehouseSuggestion ?? "wird geprüft"}</strong>Lager</span>
          </div>
          <p className="orderReviewNotice">Die Buchung wird nach Zahlung durch FLYERO geprüft. Gebiet, Druckdaten und Zustellbarkeit werden final bestätigt.</p>
          <p className="overviewDataBasis">{confidenceLabel(areaStats.confidence)}</p>
          <div className="proofIncludedList">
            <span>GPS-Nachweis enthalten</span>
            <span>Foto-Dokumentation enthalten</span>
            <span>PDF-Bericht nach Abschluss enthalten</span>
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
        <p className="orderStepHint">Wähle jetzt, wie du weitermachen möchtest. Es wird nichts doppelt berechnet und keine Anfrage erzwingt eine Zahlung.</p>
        <div className="orderFinishChoices">
          <button type="button" className="finishPrimary" disabled={isFinishing} onClick={() => finishOrder("direct_payment")}>
            Jetzt buchen und bezahlen
            <small>Gebiet sichern, Kampagne anlegen und Zahlung starten.</small>
          </button>
          <button type="button" disabled={isFinishing} onClick={() => finishOrder("inquiry")}>
            Unverbindlich anfragen
            <small>Wir prüfen Gebiet, Druckdaten und Preis und melden uns schnellstmöglich.</small>
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
        <p className="orderReviewNotice">Enthalten: GPS-Nachweis, Foto-Dokumentation und PDF-Bericht nach Abschluss. Bericht wird nach der Verteilung erstellt.</p>
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
            {orderNavItems.filter((item) => item.group === group).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={item.active ? "sideNavActive" : ""}>
                  <span><Icon aria-hidden="true" /></span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="sideNavFooter">
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
            {activeStep >= 6 ? "Abschluss wählen" : "Weiter"}
            <span aria-hidden="true">→</span>
          </button>
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
          <button type="button" className={showHeatmap ? "selected" : ""} onClick={requestHeatmap}>Heatmap</button>
        </div>
        {heatmapNotice ? <div className="heatmapNotice" role="status">{heatmapNotice}</div> : null}
        <div ref={mapElementRef} className="orderGoogleMap" aria-hidden={!mapsReady} />
        {!mapsReady ? <MiniMapFallback center={center} polygon={polygon} showHeatmap={showHeatmap} /> : null}
        {!mapsReady ? (
          <div className="mapConfigNotice" role="status">
            <strong>{mapsBrowserKeyConfigured ? "Karte wird geladen" : "Live-Karte aktuell nicht verfügbar"}</strong>
            <span>
              {mapsBrowserKeyConfigured
                ? "Einen Moment bitte. Falls die Karte nicht erscheint, können Sie die Anfrage trotzdem senden."
                : "Sie können die Anfrage trotzdem senden. FLYERO prüft das Gebiet anschließend persönlich mit Ihnen."}
            </span>
          </div>
        ) : null}
        <div className="mapZoomRail" aria-label="Kartensteuerung">
          <button type="button" onClick={() => geocodeAddress()} aria-label="Aktuelle Adresse zentrieren"><LocateFixed aria-hidden="true" /></button>
          <button type="button" onClick={() => mapRef.current?.setZoom(15)}>+</button>
          <button type="button" onClick={() => mapRef.current?.setZoom(13)}>−</button>
          <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>⛶</button>
        </div>
        <aside
          className="areaOverview"
          style={{ transform: `translate3d(${overviewOffset.x}px, ${overviewOffset.y}px, 0)` }}
        >
          <div className="overviewHead">
            <div>
              <h2>Gebietsübersicht</h2>
              <p>Live aktualisiert, sobald du das Gebiet änderst.</p>
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
            <div><dt>Preis netto zzgl. MwSt.</dt><dd>{Number(netPrice) > 0 ? formatCurrency(netPrice) : "wird berechnet"}</dd></div>
            <div><dt>Nächstes Lager</dt><dd>{areaStats.warehouseSuggestion ?? "wird geprüft"}</dd></div>
          </dl>
          <p className="availabilityGood">{deliverabilityLabel(deliverabilityScore)}</p>
        </aside>
      </section>
    </form>
  );
}


