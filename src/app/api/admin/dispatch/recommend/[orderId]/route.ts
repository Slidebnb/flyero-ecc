import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAutoDispatchRecommendations } from "@/lib/dispatch";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { orderId } = await context.params;
    return successResponse(await createAutoDispatchRecommendations({ orderId, adminUserId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
