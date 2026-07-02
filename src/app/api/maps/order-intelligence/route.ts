import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getOrderIntelligence } from "@/lib/smartMaps";
import { routeErrorResponse } from "@/lib/request";

function numberParam(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const params = new URL(request.url).searchParams;
    const data = await getOrderIntelligence({
      city: params.get("city"),
      postalCode: params.get("postalCode"),
      street: params.get("street"),
      houseNumber: params.get("houseNumber"),
      flyerQuantity: numberParam(params.get("flyerQuantity")),
      households: numberParam(params.get("households")),
      coverageAreaSqm: numberParam(params.get("coverageAreaSqm")),
      distanceMeters: numberParam(params.get("distanceMeters")),
      perimeterMeters: numberParam(params.get("perimeterMeters")),
    });
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
