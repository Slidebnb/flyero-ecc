import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { assertOrderTransition, createOrderStatusEvent } from "@/lib/orders";
import { createInvoiceForOrder } from "@/lib/invoices";
import { ensureShipmentForCustomerFlyers } from "@/lib/logistics";
import { reviewOrder } from "@/lib/orderReviewWorkflow";
import { refundPayment } from "@/lib/payments";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminOrderStatusSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.ORDER_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request);
    const parsed = adminOrderStatusSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    if (parsed.data.status === "APPROVED" && ["SUBMITTED", "UNDER_REVIEW", "PAID_WAITING_FOR_ADMIN_REVIEW"].includes(order.status)) {
      const approved = await reviewOrder({
        orderId: order.id,
        adminUserId: session.id,
        action: "approve",
        note: parsed.data.note,
        customerMessage: parsed.data.adminCustomerMessage,
      });
      if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
      return Response.json({ ok: true, data: approved });
    }

    if (parsed.data.status === "WAITING_FOR_CUSTOMER") {
      const clarification = await reviewOrder({
        orderId: order.id,
        adminUserId: session.id,
        action: "clarification",
        note: parsed.data.note,
        customerMessage: parsed.data.adminCustomerMessage,
      });
      if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
      return Response.json({ ok: true, data: clarification });
    }

    if (parsed.data.status === "REJECTED" && order.status !== "PAID_WAITING_FOR_ADMIN_REVIEW") {
      const rejected = await reviewOrder({
        orderId: order.id,
        adminUserId: session.id,
        action: "reject",
        note: parsed.data.note,
        customerMessage: parsed.data.adminCustomerMessage,
      });
      if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
      return Response.json({ ok: true, data: rejected });
    }

    try {
      assertOrderTransition(order.status, parsed.data.status);
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Ungueltiger Statuswechsel.", 409);
    }

    if (parsed.data.status === "REJECTED" && order.status === "PAID_WAITING_FOR_ADMIN_REVIEW") {
      const payment = await prisma.payment.findFirst({
        where: { orderId: order.id, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!payment) return errorResponse("Bezahlter Auftrag hat keine erstattbare Zahlung.", 409);

      await refundPayment({
        paymentId: payment.id,
        adminUserId: session.id,
        reason: typeof body.refundReason === "string" ? body.refundReason : parsed.data.note ?? "Admin-Ablehnung",
      });
      const rejected = await prisma.order.findUniqueOrThrow({ where: { id } });
      await createAuditLog({
        userId: session.id,
        action: "order.rejected",
        entityType: "Order",
        entityId: id,
        oldValues: { status: order.status },
        newValues: { status: "REJECTED", refund: true },
        metadata: { note: parsed.data.note || null },
      });

      if (request.headers.get("accept")?.includes("text/html")) {
        return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
      }
      return Response.json({ ok: true, data: rejected });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status,
        adminCustomerMessage:
          parsed.data.adminCustomerMessage ?? order.adminCustomerMessage,
      },
    });

    await createOrderStatusEvent({
      orderId: id,
      fromStatus: order.status,
      toStatus: updated.status,
      changedBy: session.id,
      note: parsed.data.note || parsed.data.adminCustomerMessage || null,
    });

    const action =
      updated.status === "APPROVED"
        ? "order.approved"
        : updated.status === "REJECTED"
          ? "order.rejected"
          : updated.status === "CANCELLED"
            ? "order.cancelled"
            : "order.status_changed";

    await createAuditLog({
      userId: session.id,
      action,
      entityType: "Order",
      entityId: id,
      oldValues: { status: order.status },
      newValues: { status: updated.status },
      metadata: { note: parsed.data.note || null },
    });

    await createNotification({
      userId: order.customer.userId,
      type: `ORDER_${updated.status}`,
      title: `Auftrag ${ORDER_STATUS_LABELS[updated.status]}`,
      message: `Auftrag ${order.orderNumber}: ${ORDER_STATUS_LABELS[updated.status]}.`,
    });
    await notifyAdmins({
      type: "ORDER_STATUS_CHANGED",
      title: "Auftragsstatus geaendert",
      message: `${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status]} -> ${ORDER_STATUS_LABELS[updated.status]}`,
    });

    if (order.status === "PAID_WAITING_FOR_ADMIN_REVIEW" && updated.status === "APPROVED") {
      await createInvoiceForOrder({ orderId: updated.id, adminUserId: session.id });
      if (order.customerOwnFlyers) {
        await ensureShipmentForCustomerFlyers({ orderId: updated.id, userId: session.id });
      }
    }

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), {
        status: 303,
      });
    }

    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}
