import { geocodeSmartAddress } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const params = new URL(request.url).searchParams;
    const value = (name: string) => params.get(name)?.trim().slice(0, 120) || undefined;
    const data = await geocodeSmartAddress({
      query: value("q"),
      postalCode: value("postalCode"),
      city: value("city"),
      street: value("street"),
      houseNumber: value("houseNumber"),
    });
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
