import { NextRequest, NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { assertOrderTransition } from "@/lib/orders";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { reviewOrder } from "@/lib/orderReviewWorkflow";
import { adminOrderStatusSchema } from "@/lib/validators";
import { productionOrderWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.ORDER_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request);
    const parsed = adminOrderStatusSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");

    const order = await prisma.order.findFirst({ where: { id, ...(session.tenantId ? { tenantId: session.tenantId } : {}), ...productionOrderWhere() }, include: { customer: true } });
    if (!order) return errorResponse("Auftrag wurde nicht gefunden.", 404);

    const reviewAction = parsed.data.status === "APPROVED"
      ? "approve"
      : parsed.data.status === "WAITING_FOR_CUSTOMER"
        ? "clarification"
        : parsed.data.status === "REJECTED"
          ? "reject"
          : null;
    if (reviewAction) {
      const result = await reviewOrder({
        orderId: order.id,
        adminUserId: session.id,
        adminTenantId: session.tenantId,
        action: reviewAction,
        note: parsed.data.note,
        customerMessage: parsed.data.adminCustomerMessage,
        rejectionReason: typeof body === "object" && body && typeof (body as Record<string, unknown>).refundReason === "string"
          ? (body as Record<string, unknown>).refundReason as string
          : parsed.data.note,
      });
      if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
      return Response.json({ ok: true, data: result });
    }

    assertOrderTransition(order.status, parsed.data.status);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({ where: { id }, data: { status: parsed.data.status, adminCustomerMessage: parsed.data.adminCustomerMessage ?? order.adminCustomerMessage } });
      await tx.orderStatusEvent.create({ data: { orderId: id, fromStatus: order.status, toStatus: changed.status, changedBy: session.id, note: parsed.data.note || parsed.data.adminCustomerMessage || null } });
      return changed;
    });
    await createAuditLog({ userId: session.id, action: "order.status_changed", entityType: "Order", entityId: id, oldValues: { status: order.status }, newValues: { status: updated.status }, metadata: { note: parsed.data.note || null } });
    await createNotification({ userId: order.customer.userId, type: "ORDER_STATUS_UPDATED", title: "Kampagnenstatus aktualisiert", message: `Auftrag ${order.orderNumber}: ${ORDER_STATUS_LABELS[updated.status]}.`, data: { orderId: order.id } });
    await notifyAdmins({ type: "ORDER_STATUS_CHANGED", title: "Auftragsstatus geaendert", message: `${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status]} -> ${ORDER_STATUS_LABELS[updated.status]}`, data: { orderId: order.id } });

    if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/orders/${id}`, request.url), { status: 303 });
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return PATCH(request, context);
}
