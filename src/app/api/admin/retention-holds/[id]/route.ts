import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse, successResponse } from "@/lib/request";
import { createAuditLog } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.RETENTION_HOLD_MANAGE);
    const { id } = await context.params;
    const current = await prisma.retentionHold.findUnique({ where: { id } });
    if (!current) return errorResponse("Aufbewahrungssperre wurde nicht gefunden.", 404);
    if (current.releasedAt) return successResponse(current);

    const releasedAt = new Date();
    const updated = await prisma.retentionHold.update({
      where: { id },
      data: { releasedAt, releasedById: session.id },
    });
    await createAuditLog({
      userId: session.id,
      tenantId: current.tenantId,
      action: "retention_hold.released",
      entityType: "RetentionHold",
      entityId: id,
      oldValues: { releasedAt: null, releasedById: null },
      newValues: { releasedAt, releasedById: session.id },
    });
    return successResponse(updated);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
