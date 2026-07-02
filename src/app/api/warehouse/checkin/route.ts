import { ErrorSeverity, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { updateLogisticsShipment } from "@/lib/logistics";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { warehouseCheckinSchema } from "@/lib/validators";
import {
  ensureInventoryForApprovedOrder,
  logWarehouseHistory,
  syncOrderStatusForInventory,
} from "@/lib/warehouse";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN]);
    const parsed = warehouseCheckinSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const data = parsed.data;
    if (session.role === UserRole.WAREHOUSE_STAFF && session.warehouseId !== data.warehouseId) {
      return errorResponse("Dieses Lager ist deinem Zugang nicht zugeordnet.", 403);
    }
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true },
    });
    if (!order) return errorResponse("Auftrag wurde nicht gefunden.", 404);
    if (order.status !== "APPROVED" && order.status !== "READY_FOR_FLYERS" && order.status !== "FLYERS_EXPECTED") {
      return errorResponse("Nur genehmigte Auftraege duerfen in den Lagerprozess.", 409);
    }
    const inventory = await ensureInventoryForApprovedOrder({
      orderId: data.orderId,
      warehouseId: data.warehouseId,
      userId: session.id,
    });
    const currentOrder = await prisma.order.findUnique({ where: { id: order.id } });
    if (currentOrder?.status === "APPROVED") {
      await syncOrderStatusForInventory({
        orderId: order.id,
        toStatus: "READY_FOR_FLYERS",
        userId: session.id,
        note: "Lagerprozess vorbereitet.",
      });
    }
    if (currentOrder?.status === "APPROVED" || currentOrder?.status === "READY_FOR_FLYERS") {
      await syncOrderStatusForInventory({
        orderId: order.id,
        toStatus: "FLYERS_EXPECTED",
        userId: session.id,
        note: "Flyer werden im Lager erwartet.",
      });
    }
    const oldValue = {
      status: inventory.status,
      warehouseLocationId: inventory.warehouseLocationId,
      receivedFlyers: inventory.receivedFlyers,
    };
    const updated = await prisma.warehouseInventory.update({
      where: { id: inventory.id },
      data: {
        warehouseId: data.warehouseId,
        warehouseLocationId: data.warehouseLocationId,
        cartonCount: data.cartonCount,
        receivedFlyers: data.receivedFlyers,
        damagedFlyers: data.damagedFlyers,
        remainingFlyers: Math.max(data.receivedFlyers - data.damagedFlyers, 0),
        weightOptional: data.weightOptional ? new Prisma.Decimal(data.weightOptional) : undefined,
        notes: data.notes || null,
        status: "STORED",
        receivedAt: new Date(),
      },
    });
    await syncOrderStatusForInventory({
      orderId: order.id,
      toStatus: "FLYERS_RECEIVED",
      userId: session.id,
      note: "Flyer im Lager angekommen.",
    });
    await syncOrderStatusForInventory({
      orderId: order.id,
      toStatus: "STORED",
      userId: session.id,
      note: "Flyer eingelagert.",
    });
    await logWarehouseHistory({
      inventoryId: updated.id,
      action: "warehouse.received",
      userId: session.id,
      oldValue,
      newValue: updated,
    });
    await createAuditLog({
      userId: session.id,
      action: "warehouse.received",
      entityType: "WarehouseInventory",
      entityId: updated.id,
      oldValues: oldValue,
      newValues: {
        status: updated.status,
        receivedFlyers: updated.receivedFlyers,
        warehouseLocationId: updated.warehouseLocationId,
      },
    });
    await createAuditLog({
      userId: session.id,
      action: "warehouse.location_assigned",
      entityType: "WarehouseInventory",
      entityId: updated.id,
      newValues: { warehouseLocationId: updated.warehouseLocationId },
    });
    const shipment = await prisma.logisticsShipment.findFirst({
      where: {
        orderId: order.id,
        warehouseId: data.warehouseId,
        status: { in: ["CREATED", "IN_TRANSIT", "DELIVERED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (shipment) {
      await updateLogisticsShipment({ id: shipment.id, actor: session, status: data.damagedFlyers > 0 ? "DAMAGED" : "RECEIVED", notes: data.notes });
    }
    await createNotification({
      userId: order.customer.userId,
      type: "WAREHOUSE_RECEIVED",
      title: "Flyer angekommen",
      message: `Flyer fuer ${order.orderNumber} sind im Lager angekommen.`,
    });
    await notifyAdmins({
      type: "WAREHOUSE_RECEIVED",
      title: "Flyer eingetroffen",
      message: `${order.orderNumber} wurde eingelagert.`,
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/warehouse/inventory/${updated.id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.HIGH,
      source: "warehouse.checkin",
      fallbackMessage: "Warehouse Check-in Fehler.",
    });
    return routeErrorResponse(error);
  }
}
