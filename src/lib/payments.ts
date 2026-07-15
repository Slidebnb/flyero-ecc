import { ErrorSeverity, Prisma, type Payment, type PaymentStatus } from "@prisma/client";
import Stripe from "stripe";
import { createAuditLog, type AuditRequestContext } from "@/lib/audit";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { createOrderStatusEvent } from "@/lib/orders";
import { classifyStripeDisputeEvent, isRefundBlockedByDispute } from "@/lib/paymentDisputeLogic";
import { calculateOrderPrice, calculatePriceFromNet, withCurrentPricingSnapshot } from "@/lib/pricing";
import { getVatRate } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getCustomerProfileCompleteness, type BillingProfileField } from "@/lib/customerProfileCompleteness";
import { approvePaidOrder } from "@/lib/orderApproval";
import { getOrderIntegrityCheck } from "@/lib/orderIntegrity";

const PROVIDER_CODE = "stripe";

export class CustomerProfileIncompleteError extends Error {
  readonly code = "CUSTOMER_PROFILE_INCOMPLETE" as const;
  readonly missingFields: BillingProfileField[];
  readonly orderId: string;

  constructor(orderId: string, missingFields: BillingProfileField[]) {
    super("Bitte vervollständige Firma, Ansprechpartner, Telefon und Rechnungsadresse, bevor du bezahlst.");
    this.name = "CustomerProfileIncompleteError";
    this.orderId = orderId;
    this.missingFields = missingFields;
  }
}

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY || "";
}

export function mockPaymentsEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ENABLE_MOCK_PAYMENTS !== "false";
}

function isMockStripe() {
  if (!mockPaymentsEnabled()) return false;
  const secret = stripeSecretKey();
  return secret.includes("_mock") || secret === "sk_test_mock" || !secret;
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

function stripeEventDate(timestamp?: number | null) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return new Date();
  return new Date(timestamp * 1000);
}

async function syncStripeDisputeEvent(event: Stripe.Event, requestContext?: AuditRequestContext) {
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : null;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;
  const payment = paymentIntentId
    ? await prisma.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } })
    : null;
  const classification = classifyStripeDisputeEvent({ type: event.type, status: dispute.status });
  const eventAt = stripeEventDate(event.created);
  const resolvedAt = classification.status === "OPEN" ? null : eventAt;
  const record = await prisma.paymentDispute.upsert({
    where: { stripeDisputeId: dispute.id },
    update: {
      ...(payment ? { paymentId: payment.id, orderId: payment.orderId, customerId: payment.customerId, tenantId: payment.tenantId } : {}),
      stripeChargeId: chargeId,
      stripePaymentIntentId: paymentIntentId,
      status: classification.status,
      reason: dispute.reason ?? null,
      amount: typeof dispute.amount === "number" ? fromCents(dispute.amount) : null,
      currency: (dispute.currency ?? "eur").toUpperCase(),
      dueBy: dispute.evidence_details?.due_by ? stripeEventDate(dispute.evidence_details.due_by) : null,
      lastEventType: event.type,
      lastEventAt: eventAt,
      resolvedAt,
    },
    create: {
      paymentId: payment?.id ?? null,
      orderId: payment?.orderId ?? null,
      customerId: payment?.customerId ?? null,
      tenantId: payment?.tenantId ?? null,
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      stripePaymentIntentId: paymentIntentId,
      status: classification.status,
      reason: dispute.reason ?? null,
      amount: typeof dispute.amount === "number" ? fromCents(dispute.amount) : null,
      currency: (dispute.currency ?? "eur").toUpperCase(),
      dueBy: dispute.evidence_details?.due_by ? stripeEventDate(dispute.evidence_details.due_by) : null,
      lastEventType: event.type,
      lastEventAt: eventAt,
      resolvedAt,
    },
  });

  await createAuditLog({
    tenantId: payment?.tenantId,
    action: `payment.dispute.${classification.status.toLowerCase()}`,
    entityType: "PaymentDispute",
    entityId: record.id,
    newValues: { stripeDisputeId: dispute.id, paymentId: payment?.id ?? null, eventType: event.type, status: classification.status },
    requestContext,
  });
  if (classification.status === "OPEN") {
    await notifyAdmins({
      type: "PAYMENT_DISPUTE_OPENED",
      title: "Stripe-Zahlungsstreitfall offen",
      message: `${payment?.orderId ? `Auftrag ${payment.orderId}: ` : "Unbekannter Auftrag: "}Stripe prüft eine Zahlung. Dispute ${dispute.id}.`,
      data: { disputeId: record.id, stripeDisputeId: dispute.id, paymentId: payment?.id ?? null },
    });
  }
  return payment;
}

export async function createCheckoutForOrder(input: { orderId: string; customerUserId: string; tenantId?: string }) {
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      customer: { userId: input.customerUserId, ...(input.tenantId ? { tenantId: input.tenantId } : {}) },
    },
    include: {
      customer: { include: { user: { select: { email: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) throw new Error("Auftrag wurde nicht gefunden.");
  if (order.needsPrintService) {
    const error = new Error("PRINT_SERVICE_CONTACT_ONLY");
    (error as Error & { code?: string }).code = "PRINT_SERVICE_CONTACT_ONLY";
    throw error;
  }
  const integrity = await getOrderIntegrityCheck(order.id);
  if (!integrity.quoteMatchesOrder || !integrity.pricingMatchesSnapshot || !integrity.flyerQuantityConsistent || !integrity.polygonReferenceMatches) {
    const error = new Error("ORDER_INTEGRITY_FAILED");
    (error as Error & { code?: string }).code = "ORDER_INTEGRITY_FAILED";
    throw error;
  }
  const profileCompleteness = getCustomerProfileCompleteness(order.customer);
  if (!profileCompleteness.complete) {
    throw new CustomerProfileIncompleteError(order.id, profileCompleteness.missingFields);
  }
  if (!["PAYMENT_PENDING", "PAYMENT_FAILED", "DRAFT", "ACCEPTED_AWAITING_PAYMENT"].includes(order.status)) {
    const error = new Error("Eine unverbindliche Anfrage muss zuerst durch FLYERO angenommen werden.");
    (error as Error & { code?: string }).code = "PAYMENT_NOT_ALLOWED_BEFORE_REVIEW";
    throw error;
  }

  const existing = order.payments.find((payment) => ["CREATED", "CHECKOUT_CREATED", "PENDING", "PAID"].includes(payment.status));
  if (existing?.status === "PAID") throw new Error("Dieser Auftrag wurde bereits bezahlt.");
  if (existing?.checkoutUrl) return existing;

  const currentSnapshot = order.priceRuleSnapshot && typeof order.priceRuleSnapshot === "object" && !Array.isArray(order.priceRuleSnapshot)
    ? order.priceRuleSnapshot as Record<string, unknown>
    : {};
  const currentPrice = order.manualPriceOverride === null
    ? await calculateOrderPrice({ serviceType: order.serviceType, flyerQuantity: order.flyerQuantity })
    : null;
  const currentManualPrice = order.manualPriceOverride !== null
    ? calculatePriceFromNet(order.manualPriceOverride, await getVatRate())
    : null;
  const pricedOrder = currentPrice
    ? await prisma.order.update({
        where: { id: order.id },
        data: {
          calculatedNetPrice: currentPrice.net,
          calculatedVat: currentPrice.vat,
          calculatedGrossPrice: currentPrice.gross,
          priceRuleSnapshot: withCurrentPricingSnapshot({
            price: currentPrice,
            snapshot: currentSnapshot,
          }),
        },
      })
    : currentManualPrice
      ? await prisma.order.update({
          where: { id: order.id },
          data: {
            calculatedNetPrice: currentManualPrice.net,
            calculatedVat: currentManualPrice.vat,
            calculatedGrossPrice: currentManualPrice.gross,
            priceRuleSnapshot: toJson({
              ...currentSnapshot,
              manualVat: currentManualPrice.vat.toString(),
              manualCalculatedGross: currentManualPrice.gross.toString(),
            }),
          },
        })
      : order;

  if (currentPrice) {
    await createAuditLog({
      userId: input.customerUserId,
      tenantId: input.tenantId,
      action: "order.price_recalculated_at_checkout",
      entityType: "Order",
      entityId: order.id,
      oldValues: { calculatedGrossPrice: order.calculatedGrossPrice.toString() },
      newValues: { calculatedGrossPrice: currentPrice.gross.toString(), pricingVersion: currentPrice.snapshot.pricingVersion },
    });
  }

  const provider = await ensureStripeProvider();
  const amount = pricedOrder.manualPriceOverride === null
    ? pricedOrder.calculatedGrossPrice
    : calculatePriceFromNet(pricedOrder.manualPriceOverride, await getVatRate()).gross;
  const description = `Flyero Auftrag ${order.orderNumber}`;
  const metadata = {
    orderId: order.id,
    customerId: order.customerId,
    report: "prepared_for_module_11",
  };
  const payment = existing ?? await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      providerId: provider.id,
      status: "CREATED",
      amount,
      currency: "EUR",
      description,
      metadata,
    },
  });
  if (!existing) await addPaymentHistory({ paymentId: payment.id, toStatus: "CREATED", reason: "checkout_requested" });
  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { amount, description, metadata },
    });
  }

  const successUrl = `${appUrl()}/customer/orders/${order.id}?payment=success`;
  const cancelUrl = `${appUrl()}/customer/orders/${order.id}?payment=cancelled`;
  if (isMockStripe() && !mockPaymentsEnabled()) {
    throw new Error("Mock-Zahlungen sind deaktiviert.");
  }
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
  await addPaymentHistory({ paymentId: payment.id, fromStatus: payment.status, toStatus: "CHECKOUT_CREATED", reason: "stripe_checkout_created" });

  if (order.status !== "PAYMENT_PENDING" && order.status !== "ACCEPTED_AWAITING_PAYMENT") {
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
  await notifyAdmins({
    type: "PAYMENT_CHECKOUT_CREATED",
    title: "Zahlung gestartet",
    message: `Für Auftrag ${order.orderNumber} wurde der Zahlungsvorgang gestartet.`,
    data: {
      orderNumber: order.orderNumber,
      customerEmail: order.customer.user.email,
      paymentId: updated.id,
      checkoutSessionId: updated.stripeCheckoutSessionId,
      grossAmount: updated.amount.toString(),
      currency: updated.currency,
      paymentStatus: updated.status,
    },
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
  if (payment?.status === "CANCELLED") {
    await createAuditLog({
      tenantId: payment.tenantId,
      action: "payment.completed_rejected_cancelled_checkout",
      entityType: "Payment",
      entityId: payment.id,
      newValues: { orderId, sessionId: session.id },
    });
    return payment;
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { user: { select: { email: true } } } } },
  });
  if (!order) throw new Error("Auftrag für Zahlung wurde nicht gefunden.");

  const currentPayment = payment ?? await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
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
  const wasAlreadyPaid = currentPayment.status === "PAID";

  const paidPayment = wasAlreadyPaid ? currentPayment : await prisma.payment.update({
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
  if (!wasAlreadyPaid) {
    await addPaymentHistory({ paymentId: paidPayment.id, fromStatus: currentPayment.status, toStatus: "PAID", reason: "checkout.session.completed" });
  }

  const acceptedAwaitingPayment = order.status === "ACCEPTED_AWAITING_PAYMENT";
  if (acceptedAwaitingPayment) {
    await approvePaidOrder({ orderId: order.id, reason: "Zahlung nach fachlicher Anfrageannahme." });
  } else if (!wasAlreadyPaid && order.status !== "PAID_WAITING_FOR_ADMIN_REVIEW" && order.status !== "APPROVED") {
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
  if (!wasAlreadyPaid) {
    await createNotification({
    userId: order.customer.userId,
    type: "PAYMENT_SUCCESS",
    title: "Zahlung erfolgreich",
    message: `Deine Zahlung für ${order.orderNumber} ist eingegangen.`,
  });
    await notifyAdmins({
    type: "PAYMENT_COMPLETED",
    title: acceptedAwaitingPayment ? "Angenommene Kampagne bezahlt" : "Neue bezahlte Bestellung",
      message: acceptedAwaitingPayment
        ? `Auftrag ${order.orderNumber} wurde bezahlt und automatisch freigegeben.`
        : `Auftrag ${order.orderNumber} wurde bezahlt und wartet auf Prüfung.`,
      data: {
        orderNumber: order.orderNumber,
        customerEmail: order.customer?.user?.email,
        paymentId: paidPayment.id,
        stripeCheckoutSessionId: paidPayment.stripeCheckoutSessionId,
        grossAmount: paidPayment.amount.toString(),
        currency: paidPayment.currency,
        paymentStatus: paidPayment.status,
      },
    });
  }

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
    include: { order: { include: { customer: { include: { user: { select: { email: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return null;
  const wasAlreadyFailed = payment.status === "FAILED";
  const failed = await updatePaymentStatus(payment, "FAILED", input.reason);
  if (payment.order.status !== "PAYMENT_FAILED" && payment.order.status !== "ACCEPTED_AWAITING_PAYMENT") {
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
  if (!wasAlreadyFailed) {
    await notifyAdmins({
      type: "PAYMENT_FAILED",
      title: "Zahlung fehlgeschlagen",
      message: `Die Zahlung für Auftrag ${payment.order.orderNumber} ist fehlgeschlagen.`,
      data: {
        orderNumber: payment.order.orderNumber,
        customerEmail: payment.order.customer.user.email,
        paymentId: payment.id,
        stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
        stripePaymentIntentId: payment.stripePaymentIntentId,
        grossAmount: payment.amount.toString(),
        currency: payment.currency,
        paymentStatus: failed.status,
        reason: input.reason,
      },
    });
  }
  return failed;
}

export async function handleStripeWebhook(input: { rawBody: string; signature: string | null; requestContext?: AuditRequestContext }) {
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
    requestContext: input.requestContext,
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
    } else if (["charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed"].includes(event.type)) {
      payment = await syncStripeDisputeEvent(event, input.requestContext);
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
  const completedRefund = payment.refunds.find((refund) => refund.status === "SUCCEEDED" && refund.type === "FULL");
  if (payment.status === "REFUNDED" && completedRefund) return completedRefund;
  const pendingRefund = payment.refunds.find((refund) => refund.status === "PENDING");
  if (pendingRefund) throw new Error("Fuer diese Zahlung wird bereits eine Erstattung verarbeitet.");
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) {
    throw new Error("Nur bezahlte Zahlungen können erstattet werden.");
  }
  const openDispute = await prisma.paymentDispute.findFirst({ where: { paymentId: payment.id, status: "OPEN" } });
  if (openDispute && isRefundBlockedByDispute(openDispute.status)) {
    throw new Error("Für diese Zahlung ist ein offener Stripe-Zahlungsstreitfall vorhanden. Bitte zuerst den Streitfall prüfen.");
  }
  const refundedAmount = payment.refunds
    .filter((refund) => refund.status === "SUCCEEDED")
    .reduce((total, refund) => total.plus(refund.amount), new Prisma.Decimal(0));
  const remainingAmount = payment.amount.minus(refundedAmount);
  if (remainingAmount.lessThanOrEqualTo(0)) {
    throw new Error("Diese Zahlung wurde bereits vollständig erstattet.");
  }
  const amount = input.amount ? new Prisma.Decimal(input.amount) : remainingAmount;
  if (amount.lessThanOrEqualTo(0) || amount.greaterThan(remainingAmount)) {
    throw new Error("Der Erstattungsbetrag überschreitet den noch offenen Zahlungsbetrag.");
  }
  const refundType = amount.lessThan(remainingAmount) ? "PARTIAL" : "FULL";
  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      orderId: payment.orderId,
      customerId: payment.customerId,
      tenantId: payment.tenantId,
      type: refundType,
      status: "PENDING",
      amount,
      currency: payment.currency,
      reason: input.reason ?? null,
      requestedById: input.adminUserId,
    },
  });

  let stripeRefund: { id: string; status: string | null };
  try {
    stripeRefund = isMockStripe()
      ? { id: `re_mock_${refund.id}`, status: "succeeded" }
      : await stripeClient().refunds.create({
          payment_intent: payment.stripePaymentIntentId ?? undefined,
          amount: toCents(amount),
          reason: "requested_by_customer",
          metadata: { paymentId: payment.id, orderId: payment.orderId, refundId: refund.id },
        });
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message.slice(0, 500) : "Der Zahlungsanbieter hat die Erstattung abgelehnt.";
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", reason: `${input.reason ?? ""}${input.reason ? " | " : ""}Erstattung fehlgeschlagen: ${failureMessage}`, processedAt: new Date() },
    });
    await createAuditLog({
      userId: input.adminUserId,
      action: "payment.refund_failed",
      entityType: "Payment",
      entityId: payment.id,
      newValues: { refundId: refund.id, reason: failureMessage },
    });
    await notifyAdmins({
      type: "PAYMENT_REFUND_FAILED",
      title: "Erstattung fehlgeschlagen",
      message: `${payment.order.orderNumber}: Die Erstattung konnte nicht abgeschlossen werden. Retry erforderlich.`,
      data: { orderId: payment.orderId, paymentId: payment.id, refundId: refund.id },
    });
    throw new Error("Die Erstattung konnte beim Zahlungsanbieter nicht abgeschlossen werden. Der Auftrag wurde nicht als erfolgreich erstattet markiert.");
  }

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
    data: {
      orderNumber: payment.order.orderNumber,
      grossAmount: amount.toString(),
      nextStep: "Bitte pruefe dein Kundenportal oder kontaktiere den Support.",
    },
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
