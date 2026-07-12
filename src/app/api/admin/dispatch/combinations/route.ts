import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { combineOrders } from "@/lib/routing";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const params = new URL(request.url).searchParams;
    const data = await combineOrders({
      city: params.get("city"),
      postalCode: params.get("postalCode"),
      tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId,
    });
    return Response.json({ ok: true, data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
