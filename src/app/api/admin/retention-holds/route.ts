import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { createRetentionHold, retentionHoldSchema } from "@/lib/retention";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { productionOrderWhere, productionRetentionHoldWhere } from "@/lib/productionData";

export async function GET(request: Request) {
  try {
    await requirePermission(Permission.RETENTION_HOLD_MANAGE);
    const orderId = new URL(request.url).searchParams.get("orderId");
    const holds = await prisma.retentionHold.findMany({
      where: { ...productionRetentionHoldWhere(), ...(orderId ? { orderId } : {}) },
      include: {
        order: { select: { id: true, orderNumber: true, tenantId: true } },
        createdBy: { select: { id: true, email: true } },
        releasedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return successResponse(holds);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.RETENTION_HOLD_MANAGE);
    const parsed = retentionHoldSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Aufbewahrungssperre.");
    if (parsed.data.expiresAt && parsed.data.expiresAt <= new Date()) {
      return errorResponse("Das Ablaufdatum muss in der Zukunft liegen.", 422);
    }

    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, ...productionOrderWhere() },
      select: { id: true, tenantId: true },
    });
    if (!order) return errorResponse("Auftrag wurde nicht gefunden.", 404);

    const hold = await createRetentionHold({
      ...parsed.data,
      createdById: session.id,
      tenantId: order.tenantId,
    });
    return successResponse(hold, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
