import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requirePermission(Permission.ORDER_VIEW);
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { user: true } },
        statusEvents: { orderBy: { createdAt: "asc" }, include: { user: true } },
      },
    });

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    return Response.json({ ok: true, data: order });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
