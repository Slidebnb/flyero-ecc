import { createAuditLog } from "@/lib/audit";
import { createCheckoutForOrder, refundPayment } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import { assertOrderTransition } from "@/lib/orders";
import { getOrderIntegrityCheck } from "@/lib/orderIntegrity";
import { approvePaidOrder } from "@/lib/orderApproval";
import { prisma } from "@/lib/prisma";

async function notifyOnce(input: {
  orderId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
}) {
  const existing = await prisma.notificationMessage.findFirst({
    where: { userId: input.userId, type: input.type, data: { path: ["orderId"], equals: input.orderId } },
    select: { id: true },
  });
  if (existing) return null;
  return createNotification({
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: { orderId: input.orderId },
  });
}

async function assertCriticalIntegrity(orderId: string) {
  const integrity = await getOrderIntegrityCheck(orderId);
  if (!integrity.quoteMatchesOrder || !integrity.pricingMatchesSnapshot || !integrity.flyerQuantityConsistent || !integrity.polygonReferenceMatches) {
    const error = new Error("ORDER_INTEGRITY_FAILED");
    (error as Error & { code?: string }).code = "ORDER_INTEGRITY_FAILED";
    throw error;
  }
}

export async function reviewOrder(input: {
  orderId: string;
  adminUserId: string;
  adminTenantId?: string | null;
  action: "approve" | "clarification" | "reject";
  note?: string;
  customerMessage?: string;
  rejectionReason?: string;
}) {
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      ...(input.adminTenantId ? { tenantId: input.adminTenantId } : {}),
    },
    include: { customer: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if ((input.action === "clarification" || input.action === "reject") && !input.customerMessage?.trim() && !input.note?.trim() && !input.rejectionReason?.trim()) {
    throw new Error("Eine Nachricht fuer den Kunden ist bei Rueckfrage oder Ablehnung erforderlich.");
  }

  if (input.action === "clarification") {
    assertOrderTransition(order.status, "WAITING_FOR_CUSTOMER");
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({
        where: { id: order.id },
        data: { status: "WAITING_FOR_CUSTOMER", adminCustomerMessage: input.customerMessage ?? input.note },
      });
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: changed.status, changedBy: input.adminUserId, note: input.note ?? input.customerMessage },
      });
      return changed;
    });
    await createAuditLog({ userId: input.adminUserId, action: "order.clarification_requested", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: updated.status } });
    await notifyOnce({ userId: order.customer.userId, orderId: order.id, type: "ORDER_CLARIFICATION_REQUESTED", title: "Rueckfrage zu deiner Kampagne", message: input.customerMessage ?? input.note ?? "Bitte ergaenze noch Angaben zu deiner Kampagne." });
    return updated;
  }

  if (input.action === "reject") {
    const paidPayment = order.payments.find((payment) => payment.status === "PAID" || payment.status === "PARTIALLY_REFUNDED");
    if (paidPayment) {
      await refundPayment({ paymentId: paidPayment.id, adminUserId: input.adminUserId, reason: input.rejectionReason ?? input.customerMessage ?? input.note });
      await createAuditLog({ userId: input.adminUserId, action: "order.rejected_after_refund", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: "REJECTED" }, metadata: { reason: input.rejectionReason ?? input.customerMessage ?? input.note } });
      return prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    }
    assertOrderTransition(order.status, "REJECTED");
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({
        where: { id: order.id },
        data: { status: "REJECTED", adminCustomerMessage: input.customerMessage ?? input.rejectionReason ?? input.note },
      });
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: changed.status, changedBy: input.adminUserId, note: input.note ?? input.customerMessage ?? input.rejectionReason },
      });
      return changed;
    });
    await createAuditLog({ userId: input.adminUserId, action: "order.rejected", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: updated.status } });
    await notifyOnce({ userId: order.customer.userId, orderId: order.id, type: "ORDER_REJECTED", title: "Kampagne nicht angenommen", message: input.customerMessage ?? input.rejectionReason ?? input.note ?? "Deine Kampagne konnte nicht angenommen werden." });
    return updated;
  }

  await assertCriticalIntegrity(order.id);
  const paid = order.payments.some((payment) => payment.status === "PAID");
  if (paid) return approvePaidOrder({ orderId: order.id, actorId: input.adminUserId, reason: input.note });
  if (order.status === "ACCEPTED_AWAITING_PAYMENT") {
    let paymentUrl: string | null = order.payments.find((payment) => ["CREATED", "CHECKOUT_CREATED", "PENDING"].includes(payment.status))?.checkoutUrl ?? null;
    try {
      const payment = await createCheckoutForOrder({ orderId: order.id, customerUserId: order.customer.userId, tenantId: order.tenantId });
      paymentUrl = payment.checkoutUrl;
    } catch (error) {
      await createAuditLog({ userId: input.adminUserId, action: "order.payment_link_deferred", entityType: "Order", entityId: order.id, newValues: { reason: error instanceof Error ? error.message : "Checkout konnte nicht vorbereitet werden." } });
    }
    await notifyOnce({ userId: order.customer.userId, orderId: order.id, type: "ORDER_ACCEPTED_PAYMENT_REQUIRED", title: "Deine Anfrage wurde angenommen", message: `Auftrag ${order.orderNumber} wurde geprueft. Bitte schliesse jetzt die Zahlung im Kundenportal ab, damit die Umsetzung starten kann.` });
    return { ...order, paymentUrl };
  }

  assertOrderTransition(order.status, "ACCEPTED_AWAITING_PAYMENT");
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.order.update({
      where: { id: order.id },
      data: { status: "ACCEPTED_AWAITING_PAYMENT", adminCustomerMessage: input.customerMessage ?? order.adminCustomerMessage },
    });
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, fromStatus: order.status, toStatus: changed.status, changedBy: input.adminUserId, note: input.note ?? "Anfrage fachlich angenommen; Zahlung steht noch aus." },
    });
    return changed;
  });
  await createAuditLog({ userId: input.adminUserId, action: "order.accepted_payment_required", entityType: "Order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: updated.status } });

  let paymentUrl: string | null = null;
  try {
    const payment = await createCheckoutForOrder({ orderId: order.id, customerUserId: order.customer.userId, tenantId: order.tenantId });
    paymentUrl = payment.checkoutUrl;
  } catch (error) {
    await createAuditLog({ userId: input.adminUserId, action: "order.payment_link_deferred", entityType: "Order", entityId: order.id, newValues: { reason: error instanceof Error ? error.message : "Checkout konnte nicht vorbereitet werden." } });
  }
  await notifyOnce({ userId: order.customer.userId, orderId: order.id, type: "ORDER_ACCEPTED_PAYMENT_REQUIRED", title: "Deine Anfrage wurde angenommen", message: `Auftrag ${order.orderNumber} wurde geprueft. Bitte schliesse jetzt die Zahlung im Kundenportal ab, damit die Umsetzung starten kann.` });
  return { ...updated, paymentUrl };
}
