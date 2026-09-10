import { NextRequest } from "next/server";
import { UserStatus } from "@prisma/client";
import { hashVerificationToken } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/verificationEmail";
import { createCheckoutForOrder } from "@/lib/payments";
import { createNotification } from "@/lib/notifications";
import { dispatchNotificationImmediately } from "@/lib/notificationWorker";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { productionCustomerWhere, productionOrderWhere } from "@/lib/productionData";
import { publicUrl } from "@/lib/publicUrl";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };
type ResendAction = "verification" | `notification:${string}` | `payment:${string}`;
type NotificationData = Record<string, string | number | boolean | null | undefined>;

function actionFromBody(body: unknown): ResendAction | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const action = (body as Record<string, unknown>).action;
  return typeof action === "string" && (action === "verification" || action.startsWith("notification:") || action.startsWith("payment:"))
    ? action as ResendAction
    : null;
}

function notificationData(value: unknown): NotificationData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry === null || entry === undefined || ["string", "number", "boolean"].includes(typeof entry)),
  ) as NotificationData;
}

function queuePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.CUSTOMER_EMAIL_SEND);
    const { id: customerId } = await context.params;
    const body = await readBody(request);
    const action = actionFromBody(body);
    if (!action) return errorResponse("Bitte wähle eine vorhandene Kunden-E-Mail aus.");

    const customer = await prisma.customerProfile.findFirst({
      where: {
        id: customerId,
        ...productionCustomerWhere(),
        ...(session.tenantId ? { tenantId: session.tenantId } : {}),
      },
      include: { user: { select: { id: true, email: true, status: true, emailVerified: true } } },
    });
    if (!customer) return errorResponse("Kunde wurde nicht gefunden.", 404);
    if (!customer.user.email?.trim()) return errorResponse("Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.", 422);

    if (action === "verification") {
      if (customer.user.status !== UserStatus.EMAIL_UNVERIFIED) {
        return errorResponse("Die E-Mail-Adresse dieses Kunden ist bereits bestätigt.", 409);
      }
      const { verificationToken } = await createEmailVerificationToken(customer.user.id, "/customer/dashboard");
      await sendVerificationEmail({ email: customer.user.email, token: verificationToken, requestUrl: request.url, customerName: customer.contactName || customer.companyName });
      await prisma.emailVerificationToken.updateMany({ where: { userId: customer.user.id, usedAt: null, tokenHash: { not: hashVerificationToken(verificationToken) } }, data: { usedAt: new Date() } });
      await createAuditLog({ userId: session.id, tenantId: customer.tenantId, action: "customer.email.resent", entityType: "CustomerProfile", entityId: customer.id, newValues: { emailType: "verification", recipientEmail: customer.user.email } });
      return successResponse({ recipientEmail: customer.user.email, label: "E-Mail-Verifizierung" });
    }

    if (action.startsWith("payment:")) {
      const orderId = action.slice("payment:".length);
      const order = await prisma.order.findFirst({
        where: { id: orderId, customerId: customer.id, ...productionOrderWhere(), ...(session.tenantId ? { tenantId: session.tenantId } : {}) },
        select: { id: true, orderNumber: true, status: true, needsPrintService: true, tenantId: true },
      });
      if (!order) return errorResponse("Der ausgewählte Auftrag gehört nicht zu diesem Kunden.", 404);
      if (order.needsPrintService) return errorResponse("Für diesen Auftrag gibt es keinen Online-Zahlungslink.", 409);
      if (!["PAYMENT_PENDING", "PAYMENT_FAILED", "DRAFT", "ACCEPTED_AWAITING_PAYMENT"].includes(order.status)) {
        return errorResponse("Für diesen Auftrag ist aktuell keine Zahlung ausstehend.", 409);
      }

      const payment = await createCheckoutForOrder({ orderId: order.id, customerUserId: customer.user.id, tenantId: order.tenantId });
      if (!payment.checkoutUrl) return errorResponse("Der Stripe-Zahlungslink konnte nicht erstellt werden.", 503);
      const campaignUrl = publicUrl(`/customer/orders/${order.id}`, request.url).toString();
      const notification = await createNotification({
        userId: customer.user.id,
        type: "ORDER_ACCEPTED_PAYMENT_REQUIRED",
        title: "Zahlung für deinen Auftrag",
        message: `Für Auftrag ${order.orderNumber} steht die Zahlung noch aus. Öffne den sicheren Stripe-Zahlungslink, um den Auftrag abzuschließen.`,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          campaignUrl,
          paymentUrl: payment.checkoutUrl,
          nextStep: "Nach erfolgreicher Zahlung wird der Auftrag automatisch weiterbearbeitet.",
        },
        forceEmail: true,
      });
      const sent = await dispatchNotificationImmediately(notification.queue?.id);
      await createAuditLog({ userId: session.id, tenantId: customer.tenantId, action: "customer.email.resent", entityType: "Order", entityId: order.id, newValues: { emailType: "payment", recipientEmail: customer.user.email, paymentId: payment.id, checkoutUrl: payment.checkoutUrl, deliveryStatus: sent?.status ?? notification.queue?.status ?? null } });
      return successResponse({ recipientEmail: customer.user.email, label: `Zahlungs-E-Mail für ${order.orderNumber}`, orderNumber: order.orderNumber, status: sent?.status ?? notification.queue?.status ?? "PENDING" });
    }

    const messageId = action.slice("notification:".length);
    const message = await prisma.notificationMessage.findFirst({
      where: { id: messageId, userId: customer.user.id, audience: "CUSTOMER" },
      include: { queues: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!message) return errorResponse("Diese Kunden-E-Mail wurde nicht gefunden.", 404);
    const data = notificationData(message.data);
    const orderId = typeof data.orderId === "string" ? data.orderId : null;
    if (orderId) {
      const order = await prisma.order.findFirst({ where: { id: orderId, customerId: customer.id, ...productionOrderWhere(), ...(session.tenantId ? { tenantId: session.tenantId } : {}) }, select: { id: true } });
      if (!order) return errorResponse("Die E-Mail gehört nicht zu einem Auftrag dieses Kunden.", 403);
    }
    const originalPayload = queuePayload(message.queues[0]?.payload);
    const resendData: NotificationData = {
      ...data,
      dashboardUrl: publicUrl("/customer/dashboard", request.url).toString(),
      ...(orderId && !message.type.includes("REPORT") && !message.type.includes("DOCUMENT")
        ? { campaignUrl: publicUrl(`/customer/orders/${orderId}`, request.url).toString() }
        : {}),
    };
    const notification = await createNotification({
      userId: customer.user.id,
      type: message.type,
      title: message.subject,
      message: message.body,
      data: resendData,
      skipTemplate: true,
      forceEmail: true,
      emailHtml: ["PAYMENT_SUCCESS", "REPORT_PUBLISHED"].includes(message.type) && typeof originalPayload.html === "string" ? originalPayload.html : undefined,
    });
    const sent = await dispatchNotificationImmediately(notification.queue?.id);
    await createAuditLog({ userId: session.id, tenantId: customer.tenantId, action: "customer.email.resent", entityType: "NotificationMessage", entityId: message.id, newValues: { emailType: message.type, recipientEmail: customer.user.email, orderId, deliveryStatus: sent?.status ?? notification.queue?.status ?? null } });
    return successResponse({ recipientEmail: customer.user.email, label: message.subject, orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : null, status: sent?.status ?? notification.queue?.status ?? "PENDING" });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
