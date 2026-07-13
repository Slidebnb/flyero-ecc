import { UserRole } from "@prisma/client";
import { getHeatmapData } from "@/lib/smartMaps";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requirePermission(Permission.ANALYTICS_VIEW);
    return Response.json({
      ok: true,
      data: await getHeatmapData(session.role === UserRole.ADMIN ? undefined : session.tenantId),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
