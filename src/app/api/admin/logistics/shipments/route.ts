import { Prisma, ShipmentStatus, ShipmentType, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createLogisticsShipment } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { logisticsShipmentCreateSchema } from "@/lib/validators";
import { productionOrderWhere } from "@/lib/productionData";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_VIEW);
    const params = request.nextUrl.searchParams;
    const status = params.get("status") as ShipmentStatus | null;
    const shipmentType = params.get("type") as ShipmentType | null;
    const warehouseId = params.get("warehouseId") || undefined;
    const shipments = await prisma.logisticsShipment.findMany({
      where: {
        order: { ...productionOrderWhere(), ...(session.role === UserRole.ADMIN ? {} : { tenantId: session.tenantId ?? "__no_tenant__" }) },
        ...(status ? { status } : {}),
        ...(shipmentType ? { shipmentType } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        order: { include: { customer: { select: { id: true, companyName: true, userId: true } } } },
        printOrder: true,
        warehouse: true,
        receivedBy: { select: { id: true, email: true, role: true, status: true } },
      },
      orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(shipments);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    const parsed = logisticsShipmentCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const data = parsed.data;
    const shipment = await createLogisticsShipment({
      ...data,
      actorId: session.id,
      tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId,
      senderAddress: data.senderAddress as Prisma.InputJsonValue | undefined,
      recipientAddress: data.recipientAddress as Prisma.InputJsonValue | undefined,
    });
    return successResponse(shipment, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
