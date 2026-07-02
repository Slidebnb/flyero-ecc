import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { dismissAutoDispatchRecommendation } from "@/lib/dispatch";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    return successResponse(await dismissAutoDispatchRecommendation({ recommendationId: id, adminUserId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
