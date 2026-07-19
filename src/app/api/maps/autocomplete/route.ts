import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getPlaceAutocomplete } from "@/lib/smartMaps";
import { customerRateLimitResponse, enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const customer = session.role === UserRole.CUSTOMER;
    const abuseDecision = await enforcePublicRateLimit(
      request,
      customer ? "customer-maps-autocomplete" : "maps-autocomplete",
      customer ? { tenantId: session.tenantId ?? "", userId: session.id } : undefined,
    );
    if (!abuseDecision.allowed) return customer ? customerRateLimitResponse(abuseDecision) : publicRateLimitResponse(abuseDecision);
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 120);
    const suggestions = query.trim().length >= 2 ? await getPlaceAutocomplete(query) : [];
    return Response.json({ ok: true, data: suggestions });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
