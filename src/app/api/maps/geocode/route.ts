import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { geocodeSmartAddress } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const abuseDecision = await enforcePublicRateLimit(request, "maps-geocode");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim().slice(0, 120) ?? "";
    const result = await geocodeSmartAddress({
      query: query || undefined,
      postalCode: params.get("postalCode") ?? undefined,
      city: params.get("city") ?? undefined,
      street: params.get("street") ?? undefined,
      houseNumber: params.get("houseNumber") ?? undefined,
      placeId: params.get("placeId")?.trim().slice(0, 160) || undefined,
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
