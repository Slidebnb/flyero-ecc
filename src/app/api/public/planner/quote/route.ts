import { z } from "zod";
import { NextRequest } from "next/server";
import { getOrderIntelligence } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { publicCapabilities } from "@/lib/publicCapabilities";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";

const quoteInputSchema = z.object({
  // Keep the legacy default for old public planner callers. New wizard
  // requests send FLYER_STANDARD explicitly, so existing quote fingerprints
  // remain compatible while the service catalog grows.
  serviceType: z.enum(["FLYER_DISTRIBUTION", "DOOR_HANGER", "BROCHURE", "MAGAZINE", "FLYER_STANDARD", "CATALOG_DISTRIBUTION", "BROCHURE_MAGAZINE", "VOUCHER_CARD", "POSTCARD_INVITATION", "EVENT_INVITATION", "COMMUNITY_PUBLICATION", "MENU_DELIVERY_CARD", "PRODUCT_SAMPLING"]).default("FLYER_DISTRIBUTION"),
  city: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(10).default(""),
  street: z.string().trim().max(120).default(""),
  houseNumber: z.string().trim().max(20).default(""),
  placeId: z.string().trim().max(160).optional(),
  locationSource: z.enum(["google", "local", "manual"]).optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  flyerQuantity: z.union([z.string(), z.number()]).optional(),
  coverageAreaSqm: z.union([z.string(), z.number()]).optional(),
  distanceMeters: z.union([z.string(), z.number()]).optional(),
  perimeterMeters: z.union([z.string(), z.number()]).optional(),
  flyerSource: z.enum(["CUSTOMER_OWN", "PRINT_SERVICE"]).optional(),
  productFormat: z.string().trim().max(80).optional(),
  weightClass: z.enum(["LIGHT", "STANDARD", "MEDIUM", "HEAVY", "CUSTOM"]).optional(),
  weightInGrams: z.union([z.string(), z.number()]).optional(),
  areaDifficulty: z.enum(["NORMAL", "MIXED", "LOW_DENSITY", "RURAL", "HARD"]).optional(),
  printDataStatus: z.enum(["UPLOADED", "UPLOAD_LATER", "PRINT_REQUESTED"]).optional(),
  preferredStartDate: z.string().optional(),
  preferredEndDate: z.string().optional(),
  targetAreaGeoJson: z.preprocess((value, context) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 250_000) {
      context.addIssue({ code: "custom", message: "Das Verteilgebiet ist zu groß oder ungültig." });
      return z.NEVER;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      context.addIssue({ code: "custom", message: "Das Verteilgebiet konnte nicht verarbeitet werden." });
      return z.NEVER;
    }
  }, z.record(z.string(), z.unknown()).optional()),
  segments: z.preprocess((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string" || !value.trim()) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }, z.array(z.record(z.string(), z.unknown())).max(50).optional()),
});

type QuoteInput = z.infer<typeof quoteInputSchema>;

function boundedNumber(value: string | number | undefined, maximum: number) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.min(parsed, maximum);
}

function boundedCoordinate(value: string | number | undefined, minimum: number, maximum: number) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function safeQueryInput(request: Request) {
  const params = new URL(request.url).searchParams;
  return {
    serviceType: params.get("serviceType") ?? undefined,
    city: params.get("city") ?? "",
    postalCode: params.get("postalCode") ?? "",
    street: params.get("street") ?? "",
    houseNumber: params.get("houseNumber") ?? "",
    placeId: params.get("placeId") ?? undefined,
    locationSource: params.get("locationSource") ?? undefined,
    latitude: params.get("latitude") ?? undefined,
    longitude: params.get("longitude") ?? undefined,
    flyerQuantity: params.get("flyerQuantity") ?? undefined,
    coverageAreaSqm: params.get("coverageAreaSqm") ?? undefined,
    distanceMeters: params.get("distanceMeters") ?? undefined,
    perimeterMeters: params.get("perimeterMeters") ?? undefined,
    flyerSource: params.get("flyerSource") ?? undefined,
    productFormat: params.get("productFormat") ?? undefined,
    weightClass: params.get("weightClass") ?? undefined,
    weightInGrams: params.get("weightInGrams") ?? undefined,
    areaDifficulty: params.get("areaDifficulty") ?? undefined,
    printDataStatus: params.get("printDataStatus") ?? undefined,
    preferredStartDate: params.get("preferredStartDate") ?? undefined,
    preferredEndDate: params.get("preferredEndDate") ?? undefined,
    segments: params.get("segments") ?? undefined,
  };
}

async function createPublicQuote(input: unknown) {
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) return errorResponse("Die Planungsdaten konnten nicht verarbeitet werden.", 400);
  const value: QuoteInput = parsed.data;
  const coverageAreaSqm = boundedNumber(value.coverageAreaSqm, 100_000_000);

  if (!value.city || !value.postalCode || !coverageAreaSqm || coverageAreaSqm <= 0) {
    return errorResponse("Bitte wähle zuerst ein Verteilgebiet aus.", 400);
  }

  if (value.flyerSource === "PRINT_SERVICE" && !publicCapabilities.onlinePrintServiceEnabled) {
    return errorResponse("Druck wird aktuell separat mit FLYERO besprochen. Bitte wähle bereits gedruckte Flyer aus.", 422);
  }

  const data = await getOrderIntelligence({
    serviceType: value.serviceType,
    city: value.city,
    postalCode: value.postalCode,
    street: value.street || null,
    houseNumber: value.houseNumber || null,
    placeId: value.placeId || null,
    locationSource: value.locationSource ?? null,
    latitude: boundedCoordinate(value.latitude, -90, 90),
    longitude: boundedCoordinate(value.longitude, -180, 180),
    flyerQuantity: Math.round(boundedNumber(value.flyerQuantity, 200_000) ?? 0) || null,
    flyerSource: value.flyerSource,
    productFormat: value.productFormat,
    weightClass: value.weightClass,
    weightInGrams: Math.round(boundedNumber(value.weightInGrams, 10_000) ?? 0) || null,
    areaDifficulty: value.areaDifficulty,
    printDataStatus: value.printDataStatus,
    preferredStartDate: value.preferredStartDate,
    preferredEndDate: value.preferredEndDate,
    targetAreaGeoJson: value.targetAreaGeoJson,
    coverageAreaSqm,
    distanceMeters: Math.round(boundedNumber(value.distanceMeters, 10_000_000) ?? 0) || null,
    perimeterMeters: Math.round(boundedNumber(value.perimeterMeters, 10_000_000) ?? 0) || null,
    segments: value.segments,
    includeOperationalData: false,
    publicOnly: true,
  });
  const { warehouse, combinations, suggestions, ...safeData } = data;
  void warehouse;
  void combinations;
  void suggestions;
  const areaReference = safeData.metrics.areaReference;
  const safeMetrics = {
    households: safeData.metrics.households,
    recommendedFlyerQuantity: safeData.metrics.recommendedFlyerQuantity,
    flyerQuantity: safeData.metrics.flyerQuantity,
    routeDistanceMeters: safeData.metrics.routeDistanceMeters,
    routeDurationMinutes: safeData.metrics.routeDurationMinutes,
    coverageAreaSqm: safeData.metrics.coverageAreaSqm,
    grossPrice: safeData.metrics.grossPrice,
    netPrice: safeData.metrics.netPrice,
    vatAmount: safeData.metrics.vatAmount,
    vatRate: safeData.metrics.vatRate,
    score: safeData.metrics.score,
    source: safeData.metrics.source,
    confidence: safeData.metrics.confidence,
    calculatedAt: safeData.metrics.calculatedAt,
    calculationVersion: safeData.metrics.calculationVersion,
    householdCountSource: safeData.metrics.householdCountSource,
    pricingVersion: safeData.metrics.pricingVersion,
    serviceLabel: safeData.metrics.serviceLabel,
    weightClass: safeData.metrics.weightClass,
    weightInGrams: safeData.metrics.weightInGrams,
    weightFactor: safeData.metrics.weightFactor,
    areaDifficulty: safeData.metrics.areaDifficulty,
    areaDifficultyFactor: safeData.metrics.areaDifficultyFactor,
    checkoutAllowed: safeData.metrics.checkoutAllowed,
    manualReviewRequired: safeData.metrics.manualReviewRequired,
    pricingRuleSignature: safeData.metrics.pricingRuleSignature,
    fingerprint: safeData.metrics.fingerprint,
    polygonHash: safeData.metrics.polygonHash,
    sources: safeData.metrics.quote?.sources,
    quoteConfidence: safeData.metrics.quote?.confidence,
    segments: safeData.metrics.segments,
    needsManualReview: safeData.metrics.needsManualReview,
    warehouseMatches: safeData.metrics.warehouseMatches,
    areaReference: areaReference
      ? {
          name: areaReference.name,
          city: areaReference.city,
          postalCode: areaReference.postalCode,
          coverageAreaSqm: areaReference.coverageAreaSqm,
          estimateMethod: areaReference.estimateMethod,
          estimateSource: areaReference.estimateSource,
          estimateSourceYear: areaReference.estimateSourceYear,
          estimateConfidence: areaReference.estimateConfidence,
        }
      : null,
  };
  const lineItems = [
    { key: "distribution", label: "Gebietsverteilung", netAmount: safeMetrics.netPrice, status: "calculated" as const },
    { key: "vat", label: `Umsatzsteuer (${safeMetrics.vatRate} %)`, netAmount: safeMetrics.vatAmount, status: "calculated" as const },
    ...(value.flyerSource === "PRINT_SERVICE"
      ? [{ key: "print", label: "Druck über FLYERO", netAmount: null, status: "requires_review" as const }]
      : []),
  ];

  return Response.json({
    ok: true,
    data: {
      metrics: safeMetrics,
      quote: {
        net: safeMetrics.netPrice,
        vat: safeMetrics.vatAmount,
        gross: safeMetrics.grossPrice,
        netAmount: safeMetrics.netPrice,
        vatAmount: safeMetrics.vatAmount,
        grossAmount: safeMetrics.grossPrice,
        vatRate: safeMetrics.vatRate,
        confidence: safeMetrics.confidence,
        pricingVersion: safeMetrics.pricingVersion,
        pricingRuleSignature: safeMetrics.pricingRuleSignature,
        fingerprint: safeMetrics.fingerprint,
        polygonHash: safeMetrics.polygonHash,
        calculatedAt: safeMetrics.calculatedAt,
        sources: safeMetrics.sources,
        confidenceByMetric: safeMetrics.quoteConfidence,
        currency: "EUR",
        lineItems,
      },
    },
  });
}

async function withPublicLimit(request: NextRequest, action: () => Promise<Response>) {
  const abuseDecision = await enforcePublicRateLimit(request, "public-planner-quote");
  if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
  return action();
}

function pricingUnavailableResponse() {
  return errorResponse("Die Preisberechnung wird gerade gepr\u00fcft. Bitte versuche es gleich erneut oder frage unverbindlich an.", 503);
}

export async function GET(request: NextRequest) {
  try {
    return await withPublicLimit(request, () => createPublicQuote(safeQueryInput(request)));
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return pricingUnavailableResponse();
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    return await withPublicLimit(request, () => createPublicQuote(body));
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return pricingUnavailableResponse();
    }
  }
}
