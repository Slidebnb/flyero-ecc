import { UserRole } from "@prisma/client";
import { dismissAutoDispatchRecommendation } from "@/lib/dispatch";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.DISPATCH_MANAGE);
    const { id } = await context.params;
    return successResponse(await dismissAutoDispatchRecommendation({ recommendationId: id, adminUserId: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
