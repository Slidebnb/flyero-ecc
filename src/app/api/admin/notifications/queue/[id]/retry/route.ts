import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { retryFailedNotification } from "@/lib/notificationWorker";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    return successResponse(await retryFailedNotification(id, session.id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
