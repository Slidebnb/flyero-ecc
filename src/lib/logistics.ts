import {
  Prisma,
  ShipmentStatus,
  ShipmentType,
  TransferStatus,
  UserRole,
  type Warehouse,
} from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

type WarehouseWithRegions = Warehouse & {
  regions: { name: string; city: string | null; postalCodes: string[]; priority: number; isActive: boolean }[];
};

export function warehouseAddressText(warehouse: Pick<Warehouse, "address" | "postalCode" | "city" | "country">) {
  const address = warehouse.address as { street?: string; houseNumber?: string; line1?: string } | null;
  return [
    address?.line1 || [address?.street, address?.houseNumber].filter(Boolean).join(" "),
    `${warehouse.postalCode} ${warehouse.city}`.trim(),
    warehouse.country,
  ].filter(Boolean).join(", ");
}

export function warehouseAddressJson(warehouse: Pick<Warehouse, "address" | "postalCode" | "city" | "country">): Prisma.InputJsonValue {
  const address = warehouse.address as { street?: string; houseNumber?: string; line1?: string } | null;
  return {
    ...(address ?? {}),
    postalCode: warehouse.postalCode,
    city: warehouse.city,
    country: warehouse.country,
  };
}

export function calculateWarehouseDistance(input: {
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
}) {
  if (input.fromLat == null || input.fromLng == null || input.toLat == null || input.toLng == null) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(input.toLat - input.fromLat);
  const dLng = toRad(input.toLng - input.fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(input.fromLat)) * Math.cos(toRad(input.toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function regionMatches(warehouse: WarehouseWithRegions, area: { city?: string | null; postalCode?: string | null }) {
  const city = area.city?.trim().toLowerCase();
  const postalCode = area.postalCode?.trim();
  return warehouse.regions
    .filter((region) => region.isActive)
    .filter((region) => {
      const cityMatch = region.city ? region.city.toLowerCase() === city : false;
      const postalMatch = postalCode ? region.postalCodes.some((code) => postalCode.startsWith(code) || code === postalCode) : false;
      return cityMatch || postalMatch;
    })
    .sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export async function getWarehouseCapacityStatus(warehouseId: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("Lager wurde nicht gefunden.");
  const utilization = warehouse.currentUtilization;
  const limit = warehouse.capacityLimit;
  const percent = limit && limit > 0 ? Math.round((utilization / limit) * 100) : null;
  return {
    warehouse,
    utilization,
    limit,
    percent,
    exceedsCapacity: Boolean(limit && utilization > limit),
    nearCapacity: Boolean(limit && utilization >= limit * 0.9),
  };
}

export async function findBestWarehouseForArea(area: {
  city?: string | null;
  postalCode?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: { regions: { where: { isActive: true } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  if (!warehouses.length) throw new Error("Kein aktives Lager vorhanden.");

  const regionMatchesByWarehouse = warehouses
    .map((warehouse) => ({ warehouse, region: regionMatches(warehouse, area) }))
    .filter((item) => item.region)
    .sort((a, b) => (b.region?.priority ?? 0) - (a.region?.priority ?? 0));

  if (regionMatchesByWarehouse[0]) {
    return {
      warehouse: regionMatchesByWarehouse[0].warehouse,
      reason: `WarehouseRegion ${regionMatchesByWarehouse[0].region?.name} passt zu ${area.postalCode || area.city}.`,
      matchedRegion: regionMatchesByWarehouse[0].region,
    };
  }

  const defaultWarehouse = warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses[0];
  return {
    warehouse: defaultWarehouse,
    reason: "Kein aktiver Regionstreffer, Default-Lager verwendet.",
    matchedRegion: null,
  };
}

export async function assignWarehouseForOrder(input: { orderId: string; userId?: string | null; reserveCapacity?: boolean }) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { distributionArea: true, customer: true, assignedWarehouse: true },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if (order.assignedWarehouseId) {
    return {
      order,
      warehouse: order.assignedWarehouse,
      reason: order.warehouseAssignmentReason ?? "Lager war bereits zugewiesen.",
      capacityWarning: false,
    };
  }

  const area = {
    city: order.distributionArea?.city ?? order.city,
    postalCode: order.distributionArea?.postalCode ?? order.postalCode,
    lat: order.targetLat ? Number(order.targetLat) : null,
    lng: order.targetLng ? Number(order.targetLng) : null,
  };
  const best = await findBestWarehouseForArea(area);
  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      assignedWarehouseId: best.warehouse.id,
      warehouseAssignedAt: new Date(),
      warehouseAssignmentReason: best.reason,
    },
    include: { assignedWarehouse: true, customer: true },
  });

  if (input.reserveCapacity) {
    await reserveWarehouseCapacity({
      warehouseId: best.warehouse.id,
      quantity: order.flyerQuantity,
      userId: input.userId ?? null,
      reason: `Auftrag ${order.orderNumber}`,
    });
  }

  const capacity = await getWarehouseCapacityStatus(best.warehouse.id);
  await createAuditLog({
    userId: input.userId ?? null,
    action: "logistics.warehouse_assigned",
    entityType: "Order",
    entityId: order.id,
    newValues: { warehouseId: best.warehouse.id, reason: best.reason },
  });
  await createNotification({
    userId: order.customer.userId,
    type: "LOGISTICS_WAREHOUSE_ASSIGNED",
    title: "Lager zugewiesen",
    message: `Fuer Auftrag ${order.orderNumber} ist ${best.warehouse.name} zustaendig.`,
    data: { orderId: order.id, warehouseId: best.warehouse.id },
  });
  if (capacity.exceedsCapacity || capacity.nearCapacity) {
    await createAuditLog({
      userId: input.userId ?? null,
      action: "logistics.capacity_warning",
      entityType: "Warehouse",
      entityId: best.warehouse.id,
      newValues: { currentUtilization: capacity.utilization, capacityLimit: capacity.limit },
    });
    await notifyAdmins({
      type: "LOGISTICS_CAPACITY_WARNING",
      title: "Kapazitätswarnung",
      message: `${best.warehouse.name}: ${capacity.utilization}/${capacity.limit ?? "-"} Flyer Auslastung.`,
      data: { warehouseId: best.warehouse.id },
    });
  }

  return { order: updated, warehouse: best.warehouse, reason: best.reason, capacityWarning: capacity.exceedsCapacity || capacity.nearCapacity };
}

export async function reserveWarehouseCapacity(input: { warehouseId: string; quantity: number; userId?: string | null; reason?: string | null }) {
  const warehouse = await prisma.warehouse.update({
    where: { id: input.warehouseId },
    data: { currentUtilization: { increment: input.quantity } },
  });
  if (warehouse.capacityLimit && warehouse.currentUtilization > warehouse.capacityLimit) {
    await createAuditLog({
      userId: input.userId ?? null,
      action: "logistics.capacity_warning",
      entityType: "Warehouse",
      entityId: warehouse.id,
      newValues: { quantity: input.quantity, reason: input.reason, currentUtilization: warehouse.currentUtilization, capacityLimit: warehouse.capacityLimit },
    });
  }
  return warehouse;
}

export async function releaseWarehouseCapacity(input: { warehouseId: string; quantity: number }) {
  return prisma.warehouse.update({
    where: { id: input.warehouseId },
    data: { currentUtilization: { decrement: input.quantity } },
  });
}

export function warehouseScopeForUser(actor: SessionUser): Prisma.WarehouseWhereInput {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPPORT_DISPATCHER) return {};
  if (actor.role === UserRole.WAREHOUSE_STAFF) return actor.warehouseId ? { id: actor.warehouseId } : { id: "__none__" };
  return { id: "__forbidden__" };
}

export function shipmentScopeForUser(actor: SessionUser): Prisma.LogisticsShipmentWhereInput {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPPORT_DISPATCHER) return {};
  if (actor.role === UserRole.WAREHOUSE_STAFF) return actor.warehouseId ? { warehouseId: actor.warehouseId } : { warehouseId: "__none__" };
  return { warehouseId: "__forbidden__" };
}

export function transferScopeForUser(actor: SessionUser): Prisma.WarehouseTransferWhereInput {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPPORT_DISPATCHER) return {};
  if (actor.role === UserRole.WAREHOUSE_STAFF && actor.warehouseId) {
    return { OR: [{ fromWarehouseId: actor.warehouseId }, { toWarehouseId: actor.warehouseId }] };
  }
  return { id: "__none__" };
}

export function inventoryScopeForUser(actor: SessionUser): Prisma.WarehouseInventoryWhereInput {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPPORT_DISPATCHER) return {};
  if (actor.role === UserRole.WAREHOUSE_STAFF) return actor.warehouseId ? { warehouseId: actor.warehouseId } : { id: "__none__" };
  return { id: "__forbidden__" };
}

export async function createLogisticsShipment(input: {
  orderId: string;
  warehouseId: string;
  shipmentType: ShipmentType;
  actorId?: string | null;
  printOrderId?: string | null;
  status?: ShipmentStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  senderName?: string | null;
  senderAddress?: Prisma.InputJsonValue | null;
  recipientName?: string | null;
  recipientAddress?: Prisma.InputJsonValue | null;
  expectedDeliveryDate?: Date | null;
  notes?: string | null;
}) {
  const shipment = await prisma.logisticsShipment.create({
    data: {
      orderId: input.orderId,
      printOrderId: input.printOrderId ?? null,
      warehouseId: input.warehouseId,
      shipmentType: input.shipmentType,
      status: input.status ?? "CREATED",
      carrier: input.carrier ?? null,
      trackingNumber: input.trackingNumber ?? null,
      senderName: input.senderName ?? null,
      senderAddress: input.senderAddress ?? undefined,
      recipientName: input.recipientName ?? null,
      recipientAddress: input.recipientAddress ?? undefined,
      expectedDeliveryDate: input.expectedDeliveryDate ?? null,
      notes: input.notes ?? null,
    },
    include: { order: { include: { customer: true } }, warehouse: true },
  });
  await createAuditLog({
    userId: input.actorId ?? null,
    action: "logistics.shipment_created",
    entityType: "LogisticsShipment",
    entityId: shipment.id,
    newValues: { status: shipment.status, shipmentType: shipment.shipmentType, warehouseId: shipment.warehouseId },
  });
  await notifyAdmins({
    type: "LOGISTICS_SHIPMENT_CREATED",
    title: "Neue Lieferung erwartet",
    message: `${shipment.order.orderNumber}: ${shipment.shipmentType} für ${shipment.warehouse.name}.`,
    data: { shipmentId: shipment.id },
  });
  return shipment;
}

export async function updateLogisticsShipment(input: {
  id: string;
  actor: SessionUser;
  status?: ShipmentStatus;
  carrier?: string | null;
  trackingNumber?: string | null;
  expectedDeliveryDate?: Date | null;
  notes?: string | null;
}) {
  const current = await prisma.logisticsShipment.findFirst({ where: { id: input.id, ...shipmentScopeForUser(input.actor) }, include: { order: { include: { customer: true } }, warehouse: true } });
  if (!current) throw new Error("Sendung wurde nicht gefunden oder ist nicht berechtigt.");
  const nextStatus = input.status ?? current.status;
  const update: Prisma.LogisticsShipmentUpdateInput = {
    status: nextStatus,
    carrier: input.carrier ?? undefined,
    trackingNumber: input.trackingNumber ?? undefined,
    expectedDeliveryDate: input.expectedDeliveryDate ?? undefined,
    notes: input.notes ?? undefined,
    deliveredAt: ["DELIVERED", "RECEIVED"].includes(nextStatus) ? new Date() : undefined,
    receivedBy: nextStatus === "RECEIVED" ? { connect: { id: input.actor.id } } : undefined,
  };
  const shipment = await prisma.logisticsShipment.update({ where: { id: current.id }, data: update, include: { order: { include: { customer: true } }, warehouse: true } });
  const action =
    shipment.status === "RECEIVED"
      ? "logistics.shipment_received"
      : shipment.status === "DAMAGED"
        ? "logistics.shipment_damaged"
        : "logistics.shipment_status_changed";
  await createAuditLog({
    userId: input.actor.id,
    action,
    entityType: "LogisticsShipment",
    entityId: shipment.id,
    oldValues: { status: current.status },
    newValues: { status: shipment.status, trackingNumber: shipment.trackingNumber },
  });
  if (shipment.status === "RECEIVED") {
    await createNotification({
      userId: shipment.order.customer.userId,
      type: "LOGISTICS_SHIPMENT_RECEIVED",
      title: "Flyer im Lager angekommen",
      message: `Lieferung für Auftrag ${shipment.order.orderNumber} ist in ${shipment.warehouse.name} eingegangen.`,
      data: { shipmentId: shipment.id, orderId: shipment.orderId },
    });
  }
  if (shipment.status === "DAMAGED") {
    await createNotification({
      userId: shipment.order.customer.userId,
      type: "LOGISTICS_SHIPMENT_DAMAGED",
      title: "Lieferung beschaedigt",
      message: `Bei Auftrag ${shipment.order.orderNumber} wurde eine beschaedigte Lieferung gemeldet.`,
      data: { shipmentId: shipment.id, orderId: shipment.orderId },
    });
    await notifyAdmins({
      type: "LOGISTICS_SHIPMENT_DAMAGED",
      title: "Beschaedigte Lieferung",
      message: `${shipment.order.orderNumber}: Lieferung in ${shipment.warehouse.name} wurde als beschaedigt markiert.`,
      data: { shipmentId: shipment.id },
    });
  }
  return shipment;
}

export async function createWarehouseTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  inventoryId: string;
  quantity: number;
  actorId?: string | null;
  notes?: string | null;
}) {
  const transfer = await prisma.warehouseTransfer.create({
    data: {
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      inventoryId: input.inventoryId,
      quantity: input.quantity,
      requestedById: input.actorId ?? null,
      notes: input.notes ?? null,
    },
    include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } } },
  });
  await createAuditLog({
    userId: input.actorId ?? null,
    action: "logistics.transfer_requested",
    entityType: "WarehouseTransfer",
    entityId: transfer.id,
    newValues: { fromWarehouseId: input.fromWarehouseId, toWarehouseId: input.toWarehouseId, quantity: input.quantity },
  });
  await notifyAdmins({
    type: "LOGISTICS_TRANSFER_REQUESTED",
    title: "Umlagerung angefragt",
    message: `${transfer.inventory.order.orderNumber}: ${transfer.fromWarehouse.name} -> ${transfer.toWarehouse.name}.`,
    data: { transferId: transfer.id },
  });
  return transfer;
}

export async function updateWarehouseTransfer(input: {
  id: string;
  actor: SessionUser;
  status: TransferStatus;
  notes?: string | null;
}) {
  const current = await prisma.warehouseTransfer.findFirst({ where: { id: input.id, ...transferScopeForUser(input.actor) } });
  if (!current) throw new Error("Umlagerung wurde nicht gefunden oder ist nicht berechtigt.");
  const transfer = await prisma.warehouseTransfer.update({
    where: { id: current.id },
    data: {
      status: input.status,
      notes: input.notes ?? undefined,
      approvedById: input.status === "APPROVED" ? input.actor.id : current.approvedById,
      shippedAt: input.status === "IN_TRANSIT" ? new Date() : current.shippedAt,
      receivedAt: input.status === "RECEIVED" ? new Date() : current.receivedAt,
    },
  });
  if (input.status === "RECEIVED") {
    await prisma.warehouseInventory.update({ where: { id: transfer.inventoryId }, data: { warehouseId: transfer.toWarehouseId } });
  }
  const action =
    input.status === "APPROVED"
      ? "logistics.transfer_approved"
      : input.status === "RECEIVED"
        ? "logistics.transfer_received"
        : "logistics.transfer_status_changed";
  await createAuditLog({
    userId: input.actor.id,
    action,
    entityType: "WarehouseTransfer",
    entityId: transfer.id,
    oldValues: { status: current.status },
    newValues: { status: transfer.status },
  });
  return transfer;
}

export async function createWarehouseStockCount(input: {
  warehouseId: string;
  inventoryId: string;
  expectedQuantity: number;
  countedQuantity: number;
  countedById?: string | null;
  notes?: string | null;
}) {
  const count = await prisma.warehouseStockCount.create({
    data: {
      warehouseId: input.warehouseId,
      inventoryId: input.inventoryId,
      expectedQuantity: input.expectedQuantity,
      countedQuantity: input.countedQuantity,
      difference: input.countedQuantity - input.expectedQuantity,
      countedById: input.countedById ?? null,
      notes: input.notes ?? null,
    },
  });
  await createAuditLog({
    userId: input.countedById ?? null,
    action: "logistics.stock_count_created",
    entityType: "WarehouseStockCount",
    entityId: count.id,
    newValues: { warehouseId: input.warehouseId, inventoryId: input.inventoryId, difference: count.difference },
  });
  return count;
}

export async function getLogisticsAnalytics() {
  const now = new Date();
  const [warehouses, openShipments, lateShipments, damagedShipments, stockDifferences, byStatus, byType, receivedShipments] = await Promise.all([
    prisma.warehouse.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.logisticsShipment.count({ where: { status: { in: ["CREATED", "IN_TRANSIT", "DELIVERED"] } } }),
    prisma.logisticsShipment.count({ where: { status: { in: ["CREATED", "IN_TRANSIT"] }, expectedDeliveryDate: { lt: now } } }),
    prisma.logisticsShipment.count({ where: { status: "DAMAGED" } }),
    prisma.warehouseStockCount.count({ where: { difference: { not: 0 } } }),
    prisma.logisticsShipment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.logisticsShipment.groupBy({ by: ["shipmentType"], _count: { _all: true } }),
    prisma.logisticsShipment.findMany({ where: { status: "RECEIVED", deliveredAt: { not: null } }, select: { createdAt: true, deliveredAt: true } }),
  ]);
  const avgHours = receivedShipments.length
    ? receivedShipments.reduce((sum, shipment) => sum + ((shipment.deliveredAt?.getTime() ?? shipment.createdAt.getTime()) - shipment.createdAt.getTime()) / 3_600_000, 0) / receivedShipments.length
    : 0;
  return {
    warehouseUtilization: warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      currentUtilization: warehouse.currentUtilization,
      capacityLimit: warehouse.capacityLimit,
      percent: warehouse.capacityLimit ? Math.round((warehouse.currentUtilization / warehouse.capacityLimit) * 100) : null,
    })),
    openShipments,
    lateShipments,
    damagedShipments,
    stockDifferences,
    averageReceivingHours: Math.round(avgHours * 10) / 10,
    shipmentsByStatus: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
    shipmentsByType: byType.map((item) => ({ shipmentType: item.shipmentType, count: item._count._all })),
  };
}

export async function ensureShipmentForCustomerFlyers(input: { orderId: string; userId?: string | null }) {
  const assigned = await assignWarehouseForOrder({ orderId: input.orderId, userId: input.userId ?? null, reserveCapacity: true });
  if (!assigned.warehouse) throw new Error("Kein Lager für Auftrag gefunden.");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: input.orderId }, include: { customer: true } });
  const existing = await prisma.logisticsShipment.findFirst({
    where: { orderId: order.id, shipmentType: "CUSTOMER_TO_WAREHOUSE" },
  });
  if (existing) return existing;
  const shipment = await createLogisticsShipment({
    orderId: order.id,
    warehouseId: assigned.warehouse.id,
    shipmentType: "CUSTOMER_TO_WAREHOUSE",
    actorId: input.userId ?? null,
    senderName: order.customer.companyName,
    recipientName: assigned.warehouse.name,
    recipientAddress: warehouseAddressJson(assigned.warehouse),
    expectedDeliveryDate: order.preferredStartDate,
    notes: `Auftragsnummer ${order.orderNumber} sichtbar auf das Paket schreiben.`,
  });
  await createNotification({
    userId: order.customer.userId,
    type: "LOGISTICS_CUSTOMER_DELIVERY_EXPECTED",
    title: "Flyerlieferung erwartet",
    message: `Bitte sende deine Flyer für ${order.orderNumber} an ${assigned.warehouse.name}, ${warehouseAddressText(assigned.warehouse)}.`,
    data: { shipmentId: shipment.id, warehouseId: assigned.warehouse.id },
  });
  return shipment;
}
