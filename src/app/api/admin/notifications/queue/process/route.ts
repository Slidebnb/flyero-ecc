import { processPendingNotifications } from "@/lib/notificationWorker";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST() {
  try {
    const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
    const result = await processPendingNotifications({ triggeredById: session.id });
    return successResponse(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
