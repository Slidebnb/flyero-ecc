import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { autoAssignRecommendedDistributor } from "@/lib/dispatch";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { orderId } = await context.params;
    return successResponse(await autoAssignRecommendedDistributor({ orderId, adminUserId: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
