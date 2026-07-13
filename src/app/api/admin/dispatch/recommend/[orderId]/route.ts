import { UserRole } from "@prisma/client";
import { createAutoDispatchRecommendations } from "@/lib/dispatch";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requirePermission(Permission.DISPATCH_MANAGE);
    const { orderId } = await context.params;
    return successResponse(await createAutoDispatchRecommendations({ orderId, adminUserId: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
