import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { processPendingNotifications } from "@/lib/notificationWorker";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST() {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const result = await processPendingNotifications({ triggeredById: session.id });
    return successResponse(result);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
