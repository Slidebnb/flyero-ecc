import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getMonitoringDashboard } from "@/lib/monitoring";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await getMonitoringDashboard());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
