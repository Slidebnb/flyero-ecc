import { findOfficialBoundaries } from "@/lib/spatialAreas";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

const MAX_TEXT = 120;

function clean(value: string | null) {
  return value?.trim().slice(0, MAX_TEXT) ?? "";
}

export async function GET(request: Request) {
  try {
    const rateLimit = await enforcePublicRateLimit(request, "maps-boundary");
    if (!rateLimit.allowed) return publicRateLimitResponse(rateLimit);

    const params = new URL(request.url).searchParams;
    const placeId = clean(params.get("placeId"));
    const city = clean(params.get("city"));
    const postalCode = clean(params.get("postalCode"));
    const featureType = clean(params.get("featureType")).toUpperCase();
    if (!placeId && !city && !postalCode) {
      return Response.json({ ok: false, error: "Gebiet konnte nicht zugeordnet werden." }, { status: 400 });
    }

    const candidates = await findOfficialBoundaries({
      placeId,
      city,
      postalCode,
      featureType,
      limit: 50,
    });

    return Response.json({ ok: true, data: candidates[0] ?? null });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
