import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getHeatmapData } from "@/lib/smartMaps";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return Response.json({ ok: true, data: await getHeatmapData() });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
