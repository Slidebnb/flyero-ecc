import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import {
  OrderStatus,
  Prisma,
  WarehouseInventoryStatus,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { assertOrderTransition, createOrderStatusEvent } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getDefaultWarehouse } from "@/lib/settings";

export function createPickupToken() {
  return randomBytes(24).toString("base64url");
}

export function createQrPayload(input: {
  orderNumber: string;
  inventoryId: string;
  warehouseId: string;
}) {
  return JSON.stringify({
    orderNumber: input.orderNumber,
    inventoryId: input.inventoryId,
    warehouseId: input.warehouseId,
  });
}

export async function createQrPngDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
  });
}

export async function logWarehouseHistory(input: {
  inventoryId: string;
  action: string;
  userId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.warehouseHistory.create({
    data: {
      inventoryId: input.inventoryId,
      action: input.action,
      userId: input.userId ?? null,
      oldValue: input.oldValue ?? Prisma.JsonNull,
      newValue: input.newValue ?? Prisma.JsonNull,
    },
  });
}

export async function syncOrderStatusForInventory(input: {
  orderId: string;
  toStatus: OrderStatus;
  userId: string;
  note?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { customer: true },
  });

  if (!order) {
    throw new Error("Auftrag wurde nicht gefunden.");
  }

  assertOrderTransition(order.status, input.toStatus);

  const updated = await prisma.order.update({
    where: { id: input.orderId },
    data: { status: input.toStatus },
  });

  await createOrderStatusEvent({
    orderId: input.orderId,
    fromStatus: order.status,
    toStatus: updated.status,
    changedBy: input.userId,
    note: input.note ?? null,
  });

  await createNotification({
    userId: order.customer.userId,
    type: `WAREHOUSE_${input.toStatus}`,
    title: ORDER_STATUS_LABELS[input.toStatus],
    message: `Auftrag ${order.orderNumber}: ${ORDER_STATUS_LABELS[input.toStatus]}.`,
  });

  return updated;
}

export function mapInventoryStatusToOrderStatus(
  status: WarehouseInventoryStatus,
): OrderStatus | null {
  if (status === "FLYERS_EXPECTED") return "FLYERS_EXPECTED";
  if (status === "FLYERS_RECEIVED") return "FLYERS_RECEIVED";
  if (status === "STORED") return "STORED";
  if (status === "READY_FOR_PICKUP") return "READY_FOR_PICKUP";
  return null;
}

export async function ensureInventoryForApprovedOrder(input: {
  orderId: string;
  warehouseId?: string | null;
  userId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { warehouseInventory: true },
  });

  if (!order) {
    throw new Error("Auftrag wurde nicht gefunden.");
  }

  if (order.warehouseInventory) {
    return order.warehouseInventory;
  }

  if (order.status !== "APPROVED" && order.status !== "READY_FOR_FLYERS") {
    throw new Error("Nur genehmigte Auftraege duerfen in den Lagerprozess.");
  }

  if (order.status === "APPROVED") {
    await syncOrderStatusForInventory({
      orderId: order.id,
      toStatus: "READY_FOR_FLYERS",
      userId: input.userId,
      note: "Lagerprozess vorbereitet.",
    });
  }

  const defaultWarehouse = input.warehouseId ? null : await getDefaultWarehouse();
  const warehouseId = input.warehouseId ?? defaultWarehouse?.id ?? "unassigned";
  const inventory = await prisma.warehouseInventory.create({
    data: {
      orderId: order.id,
      warehouseId,
      expectedFlyers: order.flyerQuantity,
      qrCode: `pending-${order.id}`,
      pickupToken: createPickupToken(),
      status: "FLYERS_EXPECTED",
    },
  });
  const payload = createQrPayload({
    orderNumber: order.orderNumber,
    inventoryId: inventory.id,
    warehouseId,
  });
  const qrCodePngDataUrl = await createQrPngDataUrl(payload);

  const updatedInventory = await prisma.warehouseInventory.update({
    where: { id: inventory.id },
    data: {
      qrCode: payload,
      qrCodePngDataUrl,
    },
  });

  await syncOrderStatusForInventory({
    orderId: order.id,
    toStatus: "FLYERS_EXPECTED",
    userId: input.userId,
    note: "Flyer werden im Lager erwartet.",
  });
  await logWarehouseHistory({
    inventoryId: inventory.id,
    action: "warehouse.qr_generated",
    userId: input.userId,
    newValue: { qrCode: payload },
  });
  await createAuditLog({
    userId: input.userId,
    action: "warehouse.qr_generated",
    entityType: "WarehouseInventory",
    entityId: inventory.id,
    newValues: { orderNumber: order.orderNumber },
  });
  await notifyAdmins({
    type: "WAREHOUSE_QR_GENERATED",
    title: "QR-Code erzeugt",
    message: `QR-Code fuer ${order.orderNumber} wurde erzeugt.`,
  });

  return updatedInventory;
}
