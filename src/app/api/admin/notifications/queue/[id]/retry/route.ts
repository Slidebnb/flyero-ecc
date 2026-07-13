import { retryFailedNotification } from "@/lib/notificationWorker";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
    const { id } = await context.params;
    return successResponse(await retryFailedNotification(id, session.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
