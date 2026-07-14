import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { requireTenantSession } from "@/lib/tenant";
import { getOrderIntelligence } from "@/lib/smartMaps";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { routeErrorResponse } from "@/lib/request";

function numberParam(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function jsonParam(value: string | null) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  try {
    const baseSession = await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const abuseDecision = await enforcePublicRateLimit(request, "maps");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const session = baseSession.role === UserRole.CUSTOMER ? await requireTenantSession() : baseSession;
    const params = new URL(request.url).searchParams;
    const data = await getOrderIntelligence({
      tenantId: session.role === UserRole.CUSTOMER ? session.tenantId : null,
      city: params.get("city"),
      postalCode: params.get("postalCode"),
      street: params.get("street"),
      houseNumber: params.get("houseNumber"),
      distributionAreaId: params.get("distributionAreaId"),
      flyerQuantity: numberParam(params.get("flyerQuantity")),
      coverageAreaSqm: numberParam(params.get("coverageAreaSqm")),
      distanceMeters: numberParam(params.get("distanceMeters")),
      perimeterMeters: numberParam(params.get("perimeterMeters")),
      segments: jsonParam(params.get("segments")),
      flyerSource: params.get("flyerSource") === "PRINT_SERVICE" ? "PRINT_SERVICE" : "CUSTOMER_OWN",
      productFormat: params.get("productFormat"),
      printDataStatus: ["UPLOADED", "UPLOAD_LATER", "PRINT_REQUESTED"].includes(params.get("printDataStatus") ?? "")
        ? params.get("printDataStatus") as "UPLOADED" | "UPLOAD_LATER" | "PRINT_REQUESTED"
        : "UPLOAD_LATER",
      preferredStartDate: params.get("preferredStartDate"),
      preferredEndDate: params.get("preferredEndDate"),
    });
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
