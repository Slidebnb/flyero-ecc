import { getPlaceAutocomplete } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const suggestions = query.length >= 2 ? await getPlaceAutocomplete(query) : [];
    return Response.json({
      ok: true,
      data: suggestions.map(({ id, label, description, city, postalCode, street, lat, lng, source }) => ({
        id,
        label,
        description,
        city,
        postalCode,
        street,
        lat,
        lng,
        source,
      })),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
