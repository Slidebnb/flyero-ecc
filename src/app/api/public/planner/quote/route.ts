import { getOrderIntelligence } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

function positiveNumber(value: string | null, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.min(parsed, maximum);
}

export async function GET(request: Request) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const params = new URL(request.url).searchParams;
    const data = await getOrderIntelligence({
      city: params.get("city")?.trim().slice(0, 80) || null,
      postalCode: params.get("postalCode")?.trim().slice(0, 10) || null,
      street: params.get("street")?.trim().slice(0, 120) || null,
      houseNumber: params.get("houseNumber")?.trim().slice(0, 20) || null,
      flyerQuantity: Math.round(positiveNumber(params.get("flyerQuantity"), 200_000) ?? 0) || null,
      coverageAreaSqm: positiveNumber(params.get("coverageAreaSqm"), 100_000_000) ?? null,
      distanceMeters: Math.round(positiveNumber(params.get("distanceMeters"), 10_000_000) ?? 0) || null,
      perimeterMeters: Math.round(positiveNumber(params.get("perimeterMeters"), 10_000_000) ?? 0) || null,
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
    return Response.json({
      ok: true,
      data: {
        metrics: safeMetrics,
        quote: {
          net: safeMetrics.netPrice,
          vat: safeMetrics.vatAmount,
          gross: safeMetrics.grossPrice,
          vatRate: safeMetrics.vatRate,
          pricingVersion: safeMetrics.pricingVersion,
          calculatedAt: safeMetrics.calculatedAt,
        },
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
