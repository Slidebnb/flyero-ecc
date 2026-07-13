import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { inventoryScopeForUser } from "@/lib/logistics";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { warehouseStatusSchema } from "@/lib/validators";
import {
  logWarehouseHistory,
  mapInventoryStatusToOrderStatus,
  syncOrderStatusForInventory,
} from "@/lib/warehouse";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN]);
    const parsed = warehouseStatusSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const inventory = await prisma.warehouseInventory.findFirst({
      where: { id: parsed.data.inventoryId, ...inventoryScopeForUser(session) },
      select: {
        id: true,
        orderId: true,
        status: true,
        remainingFlyers: true,
        remainingStockStatus: true,
        notes: true,
        preparedAt: true,
        pickupStatus: true,
        order: { select: { orderNumber: true, status: true, customer: { select: { userId: true } } } },
      },
    });
    if (!inventory) return errorResponse("Lagerbestand wurde nicht gefunden.", 404);
    const updated = await prisma.warehouseInventory.update({
      where: { id: inventory.id },
      data: {
        status: parsed.data.status,
        remainingFlyers: parsed.data.remainingFlyers ?? inventory.remainingFlyers,
        remainingStockStatus: parsed.data.remainingStockStatus ?? inventory.remainingStockStatus,
        notes: parsed.data.notes ?? inventory.notes,
        preparedAt: parsed.data.status === "READY_FOR_PICKUP" ? new Date() : inventory.preparedAt,
        pickupStatus: parsed.data.status === "READY_FOR_PICKUP" ? "PREPARED" : inventory.pickupStatus,
      },
    });
    const orderStatus = mapInventoryStatusToOrderStatus(parsed.data.status);
    if (orderStatus && inventory.order.status !== orderStatus) {
      await syncOrderStatusForInventory({
        orderId: inventory.orderId,
        toStatus: orderStatus,
        userId: session.id,
        note: parsed.data.notes || "Lagerstatus aktualisiert.",
      });
    }
    const action = parsed.data.status === "READY_FOR_PICKUP" ? "warehouse.ready_for_pickup" : "warehouse.updated";
    await logWarehouseHistory({
      inventoryId: inventory.id,
      action,
      userId: session.id,
      oldValue: { status: inventory.status, remainingFlyers: inventory.remainingFlyers },
      newValue: { status: updated.status, remainingFlyers: updated.remainingFlyers },
    });
    await createAuditLog({
      userId: session.id,
      action,
      entityType: "WarehouseInventory",
      entityId: inventory.id,
      oldValues: { status: inventory.status },
      newValues: { status: updated.status },
    });
    if (parsed.data.remainingFlyers !== undefined || parsed.data.remainingStockStatus) {
      await createAuditLog({
        userId: session.id,
        action: "warehouse.stock_changed",
        entityType: "WarehouseInventory",
        entityId: inventory.id,
        oldValues: { remainingFlyers: inventory.remainingFlyers, remainingStockStatus: inventory.remainingStockStatus },
        newValues: { remainingFlyers: updated.remainingFlyers, remainingStockStatus: updated.remainingStockStatus },
      });
    }
    if (updated.status === "READY_FOR_PICKUP") {
      await createNotification({
        userId: inventory.order.customer.userId,
        type: "WAREHOUSE_READY_FOR_PICKUP",
        title: "Abholbereit",
        message: `Flyer für ${inventory.order.orderNumber} sind abholbereit.`,
      });
    }
    await notifyAdmins({
      type: "WAREHOUSE_STATUS_CHANGED",
      title: "Lagerstatus geändert",
      message: `${inventory.order.orderNumber}: ${inventory.status} -> ${updated.status}`,
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      const referer = request.headers.get("referer") || `/warehouse/inventory/${updated.id}`;
      return NextResponse.redirect(referer, { status: 303 });
    }
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
