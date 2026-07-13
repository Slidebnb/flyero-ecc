import { runHealthCheck } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST() {
  try {
    const session = await requirePermission(Permission.MONITORING_MANAGE);
    return successResponse(await runHealthCheck(session.id), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
