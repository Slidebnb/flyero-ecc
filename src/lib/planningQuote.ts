import { createHash } from "node:crypto";
import { aggregateOrderAreaSegments, normalizeOrderAreaSegments, type FeatureCollection, type NormalizedOrderAreaSegment } from "@/lib/orderSegments";
import { normalizeServiceProductFormat } from "@/lib/serviceCatalog";

export const PLANNING_QUOTE_VERSION = "planning-quote-v1";
export const PLANNING_QUOTE_CHANGED = "PLANNING_QUOTE_CHANGED" as const;

export type PlanningInputFingerprint = {
  serviceType?: "FLYER_DISTRIBUTION" | "DOOR_HANGER" | "BROCHURE" | "MAGAZINE" | "FLYER_STANDARD" | "CATALOG_DISTRIBUTION" | "BROCHURE_MAGAZINE" | "VOUCHER_CARD" | "POSTCARD_INVITATION" | "EVENT_INVITATION" | "COMMUNITY_PUBLICATION" | "MENU_DELIVERY_CARD" | "PRODUCT_SAMPLING";
  flyerQuantity: number;
  polygonHash: string;
  placeId?: string;
  locationSource?: "google" | "local" | "manual";
  latitude?: number | null;
  longitude?: number | null;
  city: string;
  postalCode: string;
  street: string;
  houseNumber: string;
  coverageAreaSqm: number;
  flyerSource: "CUSTOMER_OWN" | "PRINT_SERVICE";
  printDataStatus: "UPLOADED" | "UPLOAD_LATER" | "PRINT_REQUESTED";
  productFormat: string;
  weightClass?: "LIGHT" | "STANDARD" | "MEDIUM" | "HEAVY" | "CUSTOM";
  weightInGrams?: number | null;
  areaDifficulty?: "NORMAL" | "MIXED" | "LOW_DENSITY" | "RURAL" | "HARD";
  pricingRuleSignature: string;
  preferredStartDate: string;
  preferredEndDate: string;
  perimeterMeters: number | null;
};

export type PlanningQuoteSources = {
  area: string;
  households: string;
  route: string;
  pricing: string;
};

export type PlanningQuoteConfidence = {
  area: "verified" | "estimated" | "unavailable";
  households: "verified" | "estimated" | "unavailable";
  route: "verified" | "estimated" | "unavailable";
};

export type AuthoritativePlanningQuote = {
  fingerprint: string;
  input: PlanningInputFingerprint;
  flyerQuantity: number;
  polygonHash: string;
  netPrice: string;
  vatAmount: string;
  grossPrice: string;
  households: number | null;
  coverageAreaSqm: number;
  routeDistanceMeters: number | null;
  routeDurationMinutes: number | null;
  pricingVersion: string;
  pricingRuleSignature: string;
  calculationVersion: string;
  calculatedAt: string;
  sources: PlanningQuoteSources;
  confidence: PlanningQuoteConfidence;
};

export type PlanningQuoteInput = {
  serviceType?: PlanningInputFingerprint["serviceType"];
  flyerQuantity: number;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  flyerSource?: "CUSTOMER_OWN" | "PRINT_SERVICE";
  printDataStatus?: "UPLOADED" | "UPLOAD_LATER" | "PRINT_REQUESTED";
  productFormat?: string | null;
  weightClass?: PlanningInputFingerprint["weightClass"];
  weightInGrams?: number | null;
  areaDifficulty?: PlanningInputFingerprint["areaDifficulty"];
  pricingRuleSignature?: string | null;
  preferredStartDate?: string | Date | null;
  preferredEndDate?: string | Date | null;
  coverageAreaSqm?: number | null;
  perimeterMeters?: number | null;
  targetAreaGeoJson?: unknown;
  areaSegments?: unknown;
  placeId?: string | null;
  locationSource?: "google" | "local" | "manual" | null;
  latitude?: number | null;
  longitude?: number | null;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function hash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function dateValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function numeric(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? Math.round(value) : null;
}

function weightClassFromInput(weightInGrams: number | null | undefined): NonNullable<PlanningInputFingerprint["weightClass"]> {
  const grams = numeric(weightInGrams);
  if (grams === null || grams <= 20) return "LIGHT";
  if (grams <= 50) return "STANDARD";
  if (grams <= 100) return "MEDIUM";
  if (grams <= 250) return "HEAVY";
  return "CUSTOM";
}

function geometryPerimeterMeters(geometry: FeatureCollection) {
  const metersPerDegree = 111_320;
  return Math.round(geometry.features.reduce((total, feature) => {
    return total + feature.geometry.coordinates[0].reduce((sum, point, index, ring) => {
      if (index === 0) return sum;
      const previous = ring[index - 1];
      const latitude = ((point[1] + previous[1]) / 2) * Math.PI / 180;
      const dx = (point[0] - previous[0]) * Math.cos(latitude) * metersPerDegree;
      const dy = (point[1] - previous[1]) * metersPerDegree;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0);
  }, 0));
}

function segmentsFromInput(input: PlanningQuoteInput) {
  if (input.areaSegments) {
    const segments = normalizeOrderAreaSegments(input.areaSegments);
    if (segments.length) return segments;
  }
  if (input.targetAreaGeoJson) {
    return normalizeOrderAreaSegments([{
      name: [input.postalCode, input.city].filter(Boolean).join(" ") || "Verteilgebiet",
      city: input.city,
      postalCode: input.postalCode,
      geometryGeoJson: input.targetAreaGeoJson,
    }]);
  }
  return [] as NormalizedOrderAreaSegment[];
}

export function normalizePlanningInput(input: PlanningQuoteInput): PlanningInputFingerprint {
  const segments = segmentsFromInput(input);
  const geometry = segments.length
    ? { type: "FeatureCollection", features: segments.flatMap((segment) => segment.geometryGeoJson.features) } satisfies FeatureCollection
    : null;
  const coverageAreaSqm = segments.length
    ? segments.reduce((sum, segment) => sum + segment.areaSqm, 0)
    : numeric(input.coverageAreaSqm) ?? 0;
  const perimeterMeters = segments.length && geometry
    ? geometryPerimeterMeters(geometry)
    : numeric(input.perimeterMeters);
  const polygonHash = hash(geometry ?? { coverageAreaSqm, city: input.city ?? "", postalCode: input.postalCode ?? "" });

  const serviceType = input.serviceType ?? "FLYER_DISTRIBUTION";
  const hasLocationIdentity = Boolean(
    input.placeId?.trim()
    || input.locationSource
    || input.latitude != null
    || input.longitude != null,
  );
  const locationIdentity = hasLocationIdentity
    ? {
        placeId: input.placeId?.trim() ?? "",
        locationSource: input.locationSource ?? "manual",
        latitude: input.latitude != null && Number.isFinite(input.latitude) ? Number(input.latitude.toFixed(6)) : null,
        longitude: input.longitude != null && Number.isFinite(input.longitude) ? Number(input.longitude.toFixed(6)) : null,
      }
    : {};
  return {
    ...(serviceType === "FLYER_DISTRIBUTION" ? {} : { serviceType }),
    flyerQuantity: Math.round(input.flyerQuantity),
    polygonHash,
    ...locationIdentity,
    city: input.city?.trim() ?? "",
    postalCode: input.postalCode?.trim() ?? "",
    street: input.street?.trim() ?? "",
    houseNumber: input.houseNumber?.trim() ?? "",
    coverageAreaSqm,
    flyerSource: input.flyerSource ?? "CUSTOMER_OWN",
    printDataStatus: input.printDataStatus ?? "UPLOAD_LATER",
    productFormat: normalizeServiceProductFormat(serviceType, input.productFormat ?? undefined),
    // Always sign the server-derived class. The client enum is only a preview
    // and must not create a second fingerprint for the same weight.
    weightClass: weightClassFromInput(input.weightInGrams),
    weightInGrams: numeric(input.weightInGrams),
    areaDifficulty: input.areaDifficulty ?? "NORMAL",
    pricingRuleSignature: input.pricingRuleSignature?.trim() ?? "",
    preferredStartDate: dateValue(input.preferredStartDate),
    preferredEndDate: dateValue(input.preferredEndDate),
    perimeterMeters,
  };
}

export function buildPlanningInputFingerprint(input: PlanningQuoteInput) {
  const normalized = normalizePlanningInput(input);
  return {
    fingerprint: hash({ version: PLANNING_QUOTE_VERSION, input: normalized }),
    polygonHash: normalized.polygonHash,
    input: normalized,
  };
}

export function planningGeometry(input: PlanningQuoteInput) {
  const segments = segmentsFromInput(input);
  const aggregated = segments.length
    ? aggregateOrderAreaSegments(segments.map((segment) => ({
        name: segment.name,
        city: segment.city,
        postalCode: segment.postalCode,
        district: segment.district,
        country: segment.country,
        geometryGeoJson: segment.geometryGeoJson,
        distributionAreaId: segment.distributionAreaId,
        flyerQuantity: segment.flyerQuantity,
        notes: segment.notes,
      })))
    : null;
  return {
    segments,
    targetAreaGeoJson: aggregated?.targetAreaGeoJson ?? null,
    coverageAreaSqm: aggregated?.totalAreaSqm ?? numeric(input.coverageAreaSqm),
    perimeterMeters: aggregated ? geometryPerimeterMeters(aggregated.targetAreaGeoJson) : numeric(input.perimeterMeters),
  };
}

export function buildAuthoritativePlanningQuote(input: {
  fingerprint: ReturnType<typeof buildPlanningInputFingerprint>;
  flyerQuantity: number;
  netPrice: string;
  vatAmount: string;
  grossPrice: string;
  households: number | null;
  coverageAreaSqm: number;
  routeDistanceMeters: number | null;
  routeDurationMinutes: number | null;
  pricingVersion: string;
  pricingRuleSignature: string;
  calculationVersion: string;
  calculatedAt: string;
  sources: PlanningQuoteSources;
  confidence: PlanningQuoteConfidence;
}): AuthoritativePlanningQuote {
  return {
    fingerprint: input.fingerprint.fingerprint,
    input: input.fingerprint.input,
    flyerQuantity: input.flyerQuantity,
    polygonHash: input.fingerprint.polygonHash,
    netPrice: input.netPrice,
    vatAmount: input.vatAmount,
    grossPrice: input.grossPrice,
    households: input.households,
    coverageAreaSqm: input.coverageAreaSqm,
    routeDistanceMeters: input.routeDistanceMeters,
    routeDurationMinutes: input.routeDurationMinutes,
    pricingVersion: input.pricingVersion,
    pricingRuleSignature: input.pricingRuleSignature,
    calculationVersion: input.calculationVersion,
    calculatedAt: input.calculatedAt,
    sources: input.sources,
    confidence: input.confidence,
  };
}
