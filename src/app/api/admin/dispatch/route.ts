import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getDispatchDashboard } from "@/lib/dispatch";
import { routeErrorResponse } from "@/lib/request";

export async function GET(request: Request) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const url = new URL(request.url);
    const dashboard = await getDispatchDashboard({
      city: url.searchParams.get("city") || undefined,
      distributorId: url.searchParams.get("distributor") || undefined,
      status: url.searchParams.get("status") || undefined,
      date: url.searchParams.get("date") || undefined,
      warehouseId: url.searchParams.get("warehouse") || undefined,
    });

    return Response.json({ ok: true, data: dashboard });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
