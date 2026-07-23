import type { ReusableAreaOption } from "@/app/components/DistributionAreaEditor";
import type { PublicLocationContext } from "@/lib/publicLocationContext";
import type { OnlineServiceType } from "@/lib/serviceCatalog";

export type LatLng = { lat: number; lng: number };
export type PolygonSource = "postal_code" | "manual" | "saved_area" | "drawn";
export type OverviewDragState = { pointerId: number; startX: number; startY: number; baseX: number; baseY: number };

export type OrderAreaSegmentDraft = {
  id: string;
  name: string;
  city: string;
  postalCode: string;
  district: string;
  country: string;
  points: LatLng[];
  geometryGeoJson?: unknown;
  polygonSource: PolygonSource;
  distributionAreaId?: string;
  flyerQuantity?: number;
  notes?: string;
};

export type LocationResult = {
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  label?: string | null;
  placeId?: string | null;
  source?: "google" | "local" | "manual" | null;
  lat: number;
  lng: number;
};

export type WizardProps = {
  areas: ReusableAreaOption[];
  today: string;
  mode?: "public_quote" | "authenticated_order";
  initialLocation?: PublicLocationContext | null;
};

export type Suggestion = {
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

export type CustomerWarehouse = {
  id: string;
  name: string;
  code: string;
  city: string;
  postalCode: string;
  country: string;
};

export type Intelligence = {
  suggestions: ReusableAreaOption[];
  metrics: {
    households: number;
    recommendedFlyerQuantity?: number;
    householdRecommendationAllowed?: boolean;
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
    residentialBuildings?: number | null;
    buildingCountSource?: string;
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
      residentialBuildings?: number | null;
    };
    segments?: Array<{
      name: string;
      city: string | null;
      postalCode: string | null;
      coverageAreaSqm: number;
      households: number;
      residentialBuildings?: number | null;
      householdCountSource: string;
      confidence: "high" | "medium" | "low";
      distributionAreaId: string | null;
    }>;
    needsManualReview?: boolean;
    manualReviewRequired?: boolean;
  };
  warehouse?: { id: string; name: string; code: string; city: string; reason: string } | null;
  combinations?: Array<{ key: string; orders: unknown[]; savedDistanceMeters: number; savedMinutes: number; savedCostEstimate: string }>;
};

export type OrderDraft = {
  serviceType?: OnlineServiceType;
  activeStep?: number;
  query?: string;
  selectedLocation?: PublicLocationContext | null;
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
  warehouseId?: string;
  flyerQuantityTouched?: boolean;
  productFormat?: string;
  weightInGrams?: number;
  productDetails?: Record<string, unknown>;
  samplingDetails?: Record<string, unknown>;
  effectiveWeightClass?: string;
  quoteFingerprint?: string;
  pricingVersion?: string;
  pricingRuleSignature?: string;
  polygonHash?: string;
  intelligenceStatus?: string;
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
