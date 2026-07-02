import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { geocodeSmartAddress } from "@/lib/smartMaps";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const params = new URL(request.url).searchParams;
    const result = await geocodeSmartAddress({
      query: params.get("q") ?? undefined,
      postalCode: params.get("postalCode") ?? undefined,
      city: params.get("city") ?? undefined,
      street: params.get("street") ?? undefined,
      houseNumber: params.get("houseNumber") ?? undefined,
    });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
