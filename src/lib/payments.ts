import { ErrorSeverity, Prisma, type Payment, type PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { createAuditLog } from "@/lib/audit";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { createOrderStatusEvent } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

const PROVIDER_CODE = "stripe";

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

function isMockStripe() {
  const secret = stripeSecretKey();
  return secret.includes("_mock") || secret === "sk_test_mock" || (process.env.NODE_ENV !== "production" && !secret);
}

function stripeClient() {
  const secret = stripeSecretKey();
  if (!secret) throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt.");
  return new Stripe(secret, { apiVersion: "2026-06-24.dahlia" });
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toCents(value: Prisma.Decimal | number) {
  return Math.round(Number(value) * 100);
}

function fromCents(value?: number | null) {
  return new Prisma.Decimal((value ?? 0) / 100).toDecimalPlaces(2);
}

export async function ensureStripeProvider() {
  return prisma.paymentProvider.upsert({
    where: { code: PROVIDER_CODE },
    update: { active: true, name: "Stripe" },
    create: { code: PROVIDER_CODE, name: "Stripe", active: true },
  });
}

async function addPaymentHistory(input: {
  paymentId: string;
  fromStatus?: PaymentStatus | null;
  toStatus: PaymentStatus;
  reason?: string | null;
}) {
  await prisma.paymentStatusHistory.create({
    data: {
      paymentId: input.paymentId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      reason: input.reason ?? null,
    },
  });
}

async function updatePaymentStatus(payment: Payment, status: PaymentStatus, reason?: string) {
  if (payment.status === status) return payment;
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : payment.paidAt,
      failedAt: status === "FAILED" ? new Date() : payment.failedAt,
      cancelledAt: status === "CANCELLED" ? new Date() : payment.cancelledAt,
      refundedAt: status === "REFUNDED" || status === "PARTIALLY_REFUNDED" ? new Date() : payment.refundedAt,
    },
  });
  await addPaymentHistory({ paymentId: payment.id, fromStatus: payment.status, toStatus: status, reason });
  return updated;
}

export async function createCheckoutForOrder(input: { orderId: string; customerUserId: string }) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, customer: { userId: input.customerUserId } },
    include: { customer: { include: { user: true } }, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if (!["PAYMENT_PENDING", "PAYMENT_FAILED", "DRAFT", "SUBMITTED"].includes(order.status)) {
    throw new Error("Fuer diesen Auftrag kann kein neuer Checkout gestartet werden.");
  }

  const existing = order.payments.find((payment) => ["CHECKOUT_CREATED", "PENDING", "PAID"].includes(payment.status));
  if (existing?.status === "PAID") throw new Error("Dieser Auftrag wurde bereits bezahlt.");
  if (existing?.checkoutUrl) return existing;

  const provider = await ensureStripeProvider();
  const amount = order.manualPriceOverride ?? order.calculatedGrossPrice;
  const description = `Flyero Auftrag ${order.orderNumber}`;
  const metadata = {
    orderId: order.id,
    customerId: order.customerId,
    report: "prepared_for_module_11",
  };
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      providerId: provider.id,
      status: "CREATED",
      amount,
      currency: "EUR",
      description,
      metadata,
    },
  });
  await addPaymentHistory({ paymentId: payment.id, toStatus: "CREATED", reason: "checkout_requested" });

  const successUrl = `${appUrl()}/customer/orders/${order.id}?payment=success`;
  const cancelUrl = `${appUrl()}/customer/orders/${order.id}?payment=cancelled`;
  const session = isMockStripe()
    ? {
        id: `cs_test_mock_${payment.id}`,
        url: `${appUrl()}/mock-stripe/checkout/${payment.id}`,
        payment_intent: `pi_mock_${payment.id}`,
      }
    : await stripeClient().checkout.sessions.create({
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: order.customer.user.email,
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: toCents(amount),
              product_data: {
                name: `Flyero ${order.orderNumber}`,
                description,
              },
            },
          },
        ],
        metadata,
        payment_intent_data: { metadata },
      });

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CHECKOUT_CREATED",
      checkoutUrl: session.url,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
    },
  });
  await addPaymentHistory({ paymentId: payment.id, fromStatus: "CREATED", toStatus: "CHECKOUT_CREATED", reason: "stripe_checkout_created" });

  if (order.status !== "PAYMENT_PENDING") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "PAYMENT_PENDING" } });
    await createOrderStatusEvent({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "PAYMENT_PENDING",
      changedBy: input.customerUserId,
      note: "Stripe Checkout gestartet.",
    });
  }

  await createAuditLog({
    userId: input.customerUserId,
    action: "payment.checkout_created",
    entityType: "Payment",
    entityId: updated.id,
    newValues: { orderId: order.id, amount: amount.toString(), checkoutSessionId: updated.stripeCheckoutSessionId },
  });

  return updated;
}

export async function completePaymentFromCheckoutSession(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error("Stripe Session ohne orderId.");
  const provider = await ensureStripeProvider();
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripeCheckoutSessionId: session.id },
        { orderId, status: { in: ["CHECKOUT_CREATED", "PENDING", "CREATED"] } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true } });
  if (!order) throw new Error("Auftrag für Zahlung wurde nicht gefunden.");

  const currentPayment = payment ?? await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      providerId: provider.id,
      status: "CREATED",
      amount: fromCents(session.amount_total),
      currency: (session.currency ?? "eur").toUpperCase(),
      description: `Flyero Auftrag ${order.orderNumber}`,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      metadata: toJson(session.metadata ?? {}),
    },
  });

  const paidPayment = await prisma.payment.update({
    where: { id: currentPayment.id },
    data: {
      status: "PAID",
      amount: fromCents(session.amount_total).greaterThan(0) ? fromCents(session.amount_total) : currentPayment.amount,
      currency: (session.currency ?? currentPayment.currency).toUpperCase(),
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : currentPayment.stripePaymentIntentId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : currentPayment.stripeCustomerId,
      paidAt: currentPayment.paidAt ?? new Date(),
      metadata: toJson(session.metadata ?? {}),
    },
  });
  if (currentPayment.status !== "PAID") {
    await addPaymentHistory({ paymentId: paidPayment.id, fromStatus: currentPayment.status, toStatus: "PAID", reason: "checkout.session.completed" });
  }

  if (order.status !== "PAID_WAITING_FOR_ADMIN_REVIEW" && order.status !== "APPROVED") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "PAID_WAITING_FOR_ADMIN_REVIEW" } });
    await createOrderStatusEvent({
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "PAID_WAITING_FOR_ADMIN_REVIEW",
      note: "Zahlung per Stripe erfolgreich.",
    });
  }

  await createAuditLog({
    action: "payment.completed",
    entityType: "Payment",
    entityId: paidPayment.id,
    newValues: { orderId: order.id, sessionId: session.id, amount: paidPayment.amount.toString() },
  });
  await createNotification({
    userId: order.customer.userId,
    type: "PAYMENT_SUCCESS",
    title: "Zahlung erfolgreich",
    message: `Deine Zahlung für ${order.orderNumber} ist eingegangen.`,
  });
  await notifyAdmins({
    type: "PAYMENT_COMPLETED",
    title: "Neue bezahlte Bestellung",
    message: `Auftrag ${order.orderNumber} wurde bezahlt und wartet auf Prüfung.`,
  });

  return paidPayment;
}

export async function markPaymentFailed(input: { orderId?: string; sessionId?: string; paymentIntentId?: string; reason: string }) {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        input.sessionId ? { stripeCheckoutSessionId: input.sessionId } : {},
        input.paymentIntentId ? { stripePaymentIntentId: input.paymentIntentId } : {},
        input.orderId ? { orderId: input.orderId } : {},
      ].filter((value) => Object.keys(value).length > 0),
    },
    include: { order: { include: { customer: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return null;
  const failed = await updatePaymentStatus(payment, "FAILED", input.reason);
  if (payment.order.status !== "PAYMENT_FAILED") {
    await prisma.order.update({ where: { id: payment.orderId }, data: { status: "PAYMENT_FAILED" } });
    await createOrderStatusEvent({
      orderId: payment.orderId,
      fromStatus: payment.order.status,
      toStatus: "PAYMENT_FAILED",
      note: input.reason,
    });
  }
  await createAuditLog({ action: "payment.failed", entityType: "Payment", entityId: payment.id, newValues: { reason: input.reason } });
  await createNotification({
    userId: payment.order.customer.userId,
    type: "PAYMENT_FAILED",
    title: "Zahlung fehlgeschlagen",
    message: `Die Zahlung für ${payment.order.orderNumber} ist fehlgeschlagen. Du kannst erneut bezahlen.`,
  });
  return failed;
}

export async function handleStripeWebhook(input: { rawBody: string; signature: string | null }) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET ist nicht gesetzt.");
  if (!input.signature) throw new Error("Stripe-Signatur fehlt.");

  const event = stripeClient().webhooks.constructEvent(input.rawBody, input.signature, webhookSecret);
  const provider = await ensureStripeProvider();
  const existing = event.id
    ? await prisma.paymentEvent.findUnique({ where: { stripeEventId: event.id } })
    : null;
  if (existing?.processedAt) return { event, duplicate: true };

  const paymentEvent = existing ?? await prisma.paymentEvent.create({
    data: {
      providerId: provider.id,
      stripeEventId: event.id,
      type: event.type,
      payload: toJson(event),
    },
  });
  await createAuditLog({
    action: "payment.webhook_received",
    entityType: "PaymentEvent",
    entityId: paymentEvent.id,
    newValues: { type: event.type, stripeEventId: event.id },
  });

  try {
    let payment: Payment | null = null;
    if (event.type === "checkout.session.completed") {
      payment = await completePaymentFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      payment = await markPaymentFailed({ orderId: session.metadata?.orderId, sessionId: session.id, reason: "checkout.session.expired" });
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      payment = await markPaymentFailed({ orderId: intent.metadata?.orderId, paymentIntentId: intent.id, reason: "payment_intent.payment_failed" });
    }
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { paymentId: payment?.id ?? null, processedAt: new Date() },
    });
    return { event, duplicate: false };
  } catch (error) {
    await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: { processingError: error instanceof Error ? error.message : "Webhookfehler" },
    });
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.CRITICAL,
      source: "stripe.webhook_processing",
      fallbackMessage: "Stripe Webhook konnte nicht verarbeitet werden.",
      metadata: { paymentEventId: paymentEvent.id, stripeEventId: event.id, type: event.type },
    });
    await notifyAdmins({
      type: "PAYMENT_WEBHOOK_ERROR",
      title: "Webhookfehler",
      message: error instanceof Error ? error.message : "Stripe Webhook konnte nicht verarbeitet werden.",
    });
    throw error;
  }
}

export async function refundPayment(input: {
  paymentId: string;
  adminUserId: string;
  reason?: string | null;
  amount?: number | null;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: { order: { include: { customer: true } }, refunds: true },
  });
  if (!payment) throw new Error("Zahlung wurde nicht gefunden.");
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) {
    throw new Error("Nur bezahlte Zahlungen können erstattet werden.");
  }
  const amount = input.amount ? new Prisma.Decimal(input.amount) : payment.amount;
  const refundType = amount.lessThan(payment.amount) ? "PARTIAL" : "FULL";
  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      customerId: payment.customerId,
      type: refundType,
      status: "PENDING",
      amount,
      currency: payment.currency,
      reason: input.reason ?? null,
      requestedById: input.adminUserId,
    },
  });

  const stripeRefund = isMockStripe()
    ? { id: `re_mock_${refund.id}`, status: "succeeded" }
    : await stripeClient().refunds.create({
        payment_intent: payment.stripePaymentIntentId ?? undefined,
        amount: toCents(amount),
        reason: "requested_by_customer",
        metadata: { paymentId: payment.id, orderId: payment.orderId, refundId: refund.id },
      });

  const updatedRefund = await prisma.refund.update({
    where: { id: refund.id },
    data: {
      status: stripeRefund.status === "failed" ? "FAILED" : "SUCCEEDED",
      stripeRefundId: stripeRefund.id,
      processedAt: new Date(),
    },
  });
  const nextStatus = refundType === "PARTIAL" ? "PARTIALLY_REFUNDED" : "REFUNDED";
  await updatePaymentStatus(payment, nextStatus, input.reason ?? "admin_refund");

  if (refundType === "FULL" && payment.order.status !== "REJECTED") {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: { status: "REJECTED", adminCustomerMessage: input.reason ?? payment.order.adminCustomerMessage },
    });
    await createOrderStatusEvent({
      orderId: payment.orderId,
      fromStatus: payment.order.status,
      toStatus: "REJECTED",
      changedBy: input.adminUserId,
      note: input.reason ?? "Auftrag abgelehnt und Zahlung erstattet.",
    });
  }

  await createAuditLog({
    userId: input.adminUserId,
    action: refundType === "PARTIAL" ? "payment.partial_refunded" : "payment.refunded",
    entityType: "Payment",
    entityId: payment.id,
    newValues: { refundId: refund.id, amount: amount.toString(), reason: input.reason ?? null },
  });
  await createNotification({
    userId: payment.order.customer.userId,
    type: "PAYMENT_REFUNDED",
    title: "Rueckerstattung erfolgt",
    message: `Die Zahlung für ${payment.order.orderNumber} wurde ${refundType === "PARTIAL" ? "teilweise " : ""}erstattet.`,
  });
  await notifyAdmins({
    type: "PAYMENT_REFUNDED",
    title: "Rueckerstattung durchgefuehrt",
    message: `${payment.order.orderNumber}: ${amount.toString()} ${payment.currency} erstattet.`,
  });

  return updatedRefund;
}
