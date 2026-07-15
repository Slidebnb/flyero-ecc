import { createAuditLog } from "@/lib/audit";
import { createInvoiceForOrder } from "@/lib/invoices";
import { ensurePrintOrderForOrder } from "@/lib/documents";
import { ensureShipmentForCustomerFlyers } from "@/lib/logistics";
import { createNotification } from "@/lib/notifications";
import { assertOrderTransition } from "@/lib/orders";
import { getOrderIntegrityCheck } from "@/lib/orderIntegrity";
import { prisma } from "@/lib/prisma";

async function notifyOrderOnce(input: {
  orderId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, string | number | null>;
}) {
  const existing = await prisma.notificationMessage.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      data: { path: ["orderId"], equals: input.orderId },
    },
    select: { id: true },
  });
  if (existing) return null;
  return createNotification({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: { orderId: input.orderId, ...(input.data ?? {}) },
  });
}

export async function approvePaidOrder(input: { orderId: string; actorId?: string | null; reason?: string }) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { customer: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1 } },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if (!order.payments[0]) throw new Error("Auftrag kann ohne erfolgreiche Zahlung nicht freigegeben werden.");

  const integrity = await getOrderIntegrityCheck(order.id);
  if (!integrity.quoteMatchesOrder || !integrity.pricingMatchesSnapshot || !integrity.flyerQuantityConsistent || !integrity.polygonReferenceMatches) {
    const error = new Error("ORDER_INTEGRITY_FAILED");
    (error as Error & { code?: string }).code = "ORDER_INTEGRITY_FAILED";
    throw error;
  }

  let updated = order;
  if (order.status !== "APPROVED") {
    assertOrderTransition(order.status, "APPROVED");
    updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({
        where: { id: order.id },
        data: { status: "APPROVED" },
        include: { customer: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 1 } },
      });
      await tx.orderStatusEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "APPROVED",
          changedBy: input.actorId ?? null,
          note: input.reason ?? "Zahlung eingegangen und Auftrag automatisch freigegeben.",
        },
      });
      return changed;
    });
  }

  const operator = input.actorId
    ? { id: input.actorId }
    : await prisma.user.findFirst({
        where: {
          role: "ADMIN",
          OR: [{ tenantId: updated.tenantId }, { tenantId: null }],
        },
        select: { id: true },
      });
  if (!operator) throw new Error("Kein Admin fuer die automatische Auftragsfreigabe vorhanden.");

  await createInvoiceForOrder({ orderId: updated.id, adminUserId: input.actorId ?? null });
  let warehouseName: string | null = null;
  if (updated.needsPrintService) {
    await ensurePrintOrderForOrder({ orderId: updated.id, adminUserId: operator.id });
  } else if (updated.customerOwnFlyers) {
    const shipment = await ensureShipmentForCustomerFlyers({ orderId: updated.id, userId: input.actorId ?? operator.id });
    const warehouse = await prisma.warehouse.findUnique({ where: { id: shipment.warehouseId }, select: { name: true } });
    warehouseName = warehouse?.name ?? null;
  }

  const type = updated.customerOwnFlyers && !updated.needsPrintService
    ? "ORDER_APPROVED_CUSTOMER_FLYERS"
    : "ORDER_APPROVED_PRINT_SERVICE";
  await notifyOrderOnce({
    orderId: updated.id,
    userId: updated.customer.userId,
    type,
    title: "Deine Kampagne wurde freigegeben",
    message: updated.customerOwnFlyers && !updated.needsPrintService
      ? `Auftrag ${updated.orderNumber} ist freigegeben. ${warehouseName ? `Das zuständige Lager ist ${warehouseName}.` : "Die Lieferinformationen stehen im Kundenportal."}`
      : `Auftrag ${updated.orderNumber} ist freigegeben. FLYERO führt den Druckprozess weiter. Eine Eigenanlieferung ist nicht erforderlich.`,
    data: { warehouseName },
  });
  await createAuditLog({
    userId: input.actorId ?? operator.id,
    tenantId: updated.tenantId,
    action: "order.approved",
    entityType: "Order",
    entityId: updated.id,
    newValues: { status: "APPROVED", fulfillment: updated.needsPrintService ? "PRINT_SERVICE" : "CUSTOMER_OWN_FLYERS" },
  });
  return updated;
}
