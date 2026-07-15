import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createAutoDispatchRecommendations } from "@/lib/dispatch";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  try {
    const session = await requirePermission(Permission.DISPATCH_MANAGE);
    const { orderId } = await context.params;
    const body = await readBody(request);
    const segmentId = typeof body.segmentId === "string" ? body.segmentId : null;
    return successResponse(await createAutoDispatchRecommendations({ orderId, adminUserId: session.id, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId, segmentId }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
