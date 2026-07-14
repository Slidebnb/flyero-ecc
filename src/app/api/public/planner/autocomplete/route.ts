import { z } from "zod";
import { getPlaceAutocomplete } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { errorResponse, routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const parsedQuery = z.string().trim().max(120).safeParse(new URL(request.url).searchParams.get("q") ?? "");
    if (!parsedQuery.success) return errorResponse("Die Sucheingabe ist zu lang.", 400);
    const query = parsedQuery.data;
    const suggestions = query.length >= 2 ? await getPlaceAutocomplete(query, { publicOnly: true }) : [];
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
