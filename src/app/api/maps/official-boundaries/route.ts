import { findOfficialBoundaries } from "@/lib/spatialAreas";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

function numberParam(value: string | null, min: number, max: number) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function textParam(value: string | null) {
  return value?.trim().slice(0, 120) ?? "";
}

export async function GET(request: Request) {
  try {
    const rateLimit = await enforcePublicRateLimit(request, "maps-boundary");
    if (!rateLimit.allowed) return publicRateLimitResponse(rateLimit);

    const params = new URL(request.url).searchParams;
    const latitude = numberParam(params.get("lat"), -90, 90);
    const longitude = numberParam(params.get("lng"), -180, 180);
    const city = textParam(params.get("city"));
    const postalCode = textParam(params.get("postalCode"));
    const featureType = textParam(params.get("featureType")).toUpperCase();
    if (latitude == null || longitude == null) {
      return Response.json({ ok: false, error: "Für die Gebietsgrenzen fehlt noch die Kartenposition." }, { status: 400 });
    }

    const data = await findOfficialBoundaries({ latitude, longitude, city, postalCode, featureType, limit: 20 });
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
