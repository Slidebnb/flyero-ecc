import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getPlaceAutocomplete } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const abuseDecision = await enforcePublicRateLimit(request, "maps");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
    const suggestions = query.trim().length >= 2 ? await getPlaceAutocomplete(query) : [];
    return Response.json({ ok: true, data: suggestions });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
