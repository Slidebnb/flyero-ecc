import { UserRole } from "@prisma/client";
import { getDispatchDashboard } from "@/lib/dispatch";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    const session = await requirePermission(Permission.DISPATCH_VIEW);
    const url = new URL(request.url);
    const dashboard = await getDispatchDashboard({
      city: url.searchParams.get("city") || undefined,
      distributorId: url.searchParams.get("distributor") || undefined,
      status: url.searchParams.get("status") || undefined,
      date: url.searchParams.get("date") || undefined,
      warehouseId: url.searchParams.get("warehouse") || undefined,
    }, session.role === UserRole.ADMIN ? undefined : session.tenantId);

    return Response.json({ ok: true, data: dashboard });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
