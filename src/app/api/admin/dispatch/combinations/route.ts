import { UserRole } from "@prisma/client";
import { combineOrders } from "@/lib/routing";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requirePermission(Permission.DISPATCH_VIEW);
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
