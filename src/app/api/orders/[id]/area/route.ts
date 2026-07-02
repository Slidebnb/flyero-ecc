import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER, UserRole.CUSTOMER]);
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: {
        id,
        ...(session.role === "CUSTOMER" ? { customer: { userId: session.id } } : {}),
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
