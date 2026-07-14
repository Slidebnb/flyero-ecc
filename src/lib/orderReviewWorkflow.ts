import { createAuditLog } from "@/lib/audit";
import { createInvoiceForOrder } from "@/lib/invoices";
import { ensurePrintOrderForOrder } from "@/lib/documents";
import { ensureShipmentForCustomerFlyers } from "@/lib/logistics";
import { createNotification } from "@/lib/notifications";
import { createOrderStatusEvent } from "@/lib/orders";
import { assertOrderTransition } from "@/lib/orders";
import { createCheckoutForOrder } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

function snapshotValue(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function orderNotificationData(order: {
  id: string;
  orderNumber: string;
  targetAreaName: string;
  city: string;
  postalCode: string;
  flyerQuantity: number;
  calculatedNetPrice: unknown;
  calculatedVat: unknown;
  calculatedGrossPrice: unknown;
  customer: { companyName: string; contactName: string };
}) {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    customerName: order.customer.contactName,
    companyName: order.customer.companyName,
    orderNumber: order.orderNumber,
    areaName: order.targetAreaName,
    city: order.city,
    postalCode: order.postalCode,
    flyerQuantity: order.flyerQuantity,
    netAmount: String(order.calculatedNetPrice),
    vatAmount: String(order.calculatedVat),
    grossAmount: String(order.calculatedGrossPrice),
    campaignUrl: `${appUrl}/customer/orders/${order.id}`,
    paymentUrl: `${appUrl}/customer/payments`,
    invoiceUrl: `${appUrl}/customer/invoices`,
    dashboardUrl: `${appUrl}/customer/dashboard`,
    nextStep: "Bitte oeffne dein Kundenportal.",
    supportEmail: process.env.SUPPORT_EMAIL ?? "support@flyero.org",
  };
}

export async function reviewOrder(input: {
  orderId: string;
  adminUserId: string;
  action: "approve" | "clarification" | "reject";
  note?: string;
  customerMessage?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { customer: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if ((input.action === "clarification" || input.action === "reject") && !input.customerMessage?.trim() && !input.note?.trim()) {
    throw new Error("Eine Nachricht für den Kunden ist bei Rückfrage oder Ablehnung erforderlich.");
  }
  if (input.action === "approve" && order.status === "APPROVED") {
    const paid = order.payments.some((payment) => payment.status === "PAID");
    if (paid) {
      await createInvoiceForOrder({ orderId: order.id, adminUserId: input.adminUserId });
      if (order.customerOwnFlyers) await ensureShipmentForCustomerFlyers({ orderId: order.id, userId: input.adminUserId });
      if (order.needsPrintService) await ensurePrintOrderForOrder({ orderId: order.id, adminUserId: input.adminUserId });
    }
    return order;
  }
  if (input.action === "clarification") {
    assertOrderTransition(order.status, "WAITING_FOR_CUSTOMER");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "WAITING_FOR_CUSTOMER", adminCustomerMessage: input.customerMessage ?? input.note },
    });
    await createOrderStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: updated.status, changedBy: input.adminUserId, note: input.note ?? input.customerMessage });
    await createAuditLog({ userId: input.adminUserId, action: "order.clarification_requested", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: updated.status, message: input.customerMessage ?? input.note } });
    await createNotification({ userId: order.customer.userId, type: "ORDER_CLARIFICATION_REQUESTED", title: "Rückfrage zu deiner Kampagne", message: input.customerMessage ?? input.note ?? "Bitte ergänze noch Angaben zu deiner Kampagne." });
    return updated;
  }
  if (input.action === "reject") {
    assertOrderTransition(order.status, "REJECTED");
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "REJECTED", adminCustomerMessage: input.customerMessage ?? input.note },
    });
    await createOrderStatusEvent({ orderId: order.id, fromStatus: order.status, toStatus: updated.status, changedBy: input.adminUserId, note: input.note ?? input.customerMessage });
    await createAuditLog({ userId: input.adminUserId, action: "order.rejected", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: updated.status }, metadata: { reason: input.customerMessage ?? input.note } });
    await createNotification({ userId: order.customer.userId, type: "ORDER_REJECTED", title: "Kampagne nicht angenommen", message: input.customerMessage ?? input.note ?? "Deine Kampagne konnte nicht angenommen werden." });
    return updated;
  }

  const snapshot = order.priceRuleSnapshot;
  const paid = order.payments.some((payment) => payment.status === "PAID");
  const completionPath = snapshotValue(snapshot, "completionPath");
  const targetStatus = paid ? "APPROVED" : "PAYMENT_PENDING";
  assertOrderTransition(order.status, targetStatus);
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.update({
      where: { id: order.id },
      data: { status: targetStatus, adminCustomerMessage: input.customerMessage ?? order.adminCustomerMessage },
    });
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: targetStatus, changedBy: input.adminUserId, note: input.note ?? "Adminprüfung abgeschlossen." },
    });
    return changed;
  });
  await createAuditLog({ userId: input.adminUserId, action: paid ? "order.approved" : "order.accepted_payment_required", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: targetStatus, completionPath } });

  if (paid) {
    await createInvoiceForOrder({ orderId: order.id, adminUserId: input.adminUserId });
    let shipmentWarehouse: { name: string; address: unknown } | null = null;
    if (order.customerOwnFlyers) {
      const shipment = await ensureShipmentForCustomerFlyers({ orderId: order.id, userId: input.adminUserId });
      shipmentWarehouse = await prisma.warehouse.findUnique({ where: { id: shipment.warehouseId }, select: { name: true, address: true } });
    } else {
      const printOrder = await ensurePrintOrderForOrder({ orderId: order.id, adminUserId: input.adminUserId });
      await createAuditLog({
        userId: input.adminUserId,
        action: "print.order_created_from_approval",
        entityType: "PrintOrder",
        entityId: printOrder.id,
        newValues: { orderId: order.id, quantity: printOrder.quantity },
      });
    }
    await createNotification({
      userId: order.customer.userId,
      type: order.customerOwnFlyers ? "ORDER_APPROVED_CUSTOMER_FLYERS" : "ORDER_APPROVED_PRINT_SERVICE",
      title: "Deine Kampagne wurde angenommen",
      message: order.customerOwnFlyers
        ? `Auftrag ${order.orderNumber} ist angenommen. Bitte sende deine Flyer an das zugewiesene Lager.`
        : `Auftrag ${order.orderNumber} ist angenommen. FLYERO startet jetzt den Druckprozess.`,
      data: {
        ...orderNotificationData(order),
        warehouseName: shipmentWarehouse?.name ?? null,
        warehouseAddress: shipmentWarehouse?.address ? JSON.stringify(shipmentWarehouse.address) : null,
        packageReference: order.orderNumber,
        nextStep: order.customerOwnFlyers ? "Bitte sende deine Flyer an das zugewiesene Lager." : "FLYERO bereitet den Druck vor.",
      },
    });
  } else {
    let paymentUrl: string | null = null;
    try {
      const payment = await createCheckoutForOrder({ orderId: order.id, customerUserId: order.customer.userId, tenantId: order.tenantId });
      paymentUrl = payment.checkoutUrl;
    } catch (error) {
      await createAuditLog({
        userId: input.adminUserId,
        action: "order.payment_link_deferred",
        entityType: "Order",
        entityId: order.id,
        newValues: { reason: error instanceof Error ? error.message : "Checkout konnte nicht vorbereitet werden." },
      });
    }
    await createNotification({
      userId: order.customer.userId,
      type: "ORDER_ACCEPTED_PAYMENT_REQUIRED",
      data: { ...orderNotificationData(order), paymentUrl: paymentUrl ?? `${process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""}/customer/payments`, nextStep: "Zahlung abschließen." },
      title: "Deine Anfrage wurde angenommen",
      message: `Auftrag ${order.orderNumber} wurde geprüft. Bitte schließe jetzt die Zahlung im Kundenportal ab, damit die Umsetzung starten kann.`,
    });
  }
  return updated;
}
