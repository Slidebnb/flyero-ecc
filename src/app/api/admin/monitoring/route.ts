import { getMonitoringDashboard } from "@/lib/monitoring";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.MONITORING_VIEW);
    return successResponse(await getMonitoringDashboard());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
