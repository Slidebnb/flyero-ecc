import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { requireTenantSession } from "@/lib/tenant";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const baseSession = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER]);
    const session = baseSession.role === UserRole.CUSTOMER ? await requireTenantSession() : baseSession;
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: {
        id,
        ...(session.role === "CUSTOMER" ? { tenantId: session.tenantId!, customer: { userId: session.id, tenantId: session.tenantId! } } : {}),
      },
      include: {
        distributionArea: {
          include: {
            polygons: { orderBy: { sortOrder: "asc" } },
            estimates: { orderBy: { createdAt: "desc" }, take: 5 },
            history: { orderBy: { createdAt: "desc" }, take: 10 },
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    return Response.json({
      ok: true,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        area: order.distributionArea,
        targetAreaGeoJson: order.targetAreaGeoJson,
        estimatedHouseholds: order.estimatedHouseholds,
        estimatedFlyers: order.estimatedFlyers,
        estimatedDistanceMeters: order.estimatedDistanceMeters,
        coverageAreaSqm: order.coverageAreaSqm,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
