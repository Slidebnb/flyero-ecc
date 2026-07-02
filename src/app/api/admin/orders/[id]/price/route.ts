import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminOrderPriceSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const parsed = adminOrderPriceSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: { where: { status: { in: ["CHECKOUT_CREATED", "PENDING", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } } },
    });
    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }
    if (order.payments.length > 0) {
      return errorResponse("Der Preis kann nach gestarteter oder erfolgreicher Zahlung nicht mehr geaendert werden.", 409);
    }

    const override = new Prisma.Decimal(parsed.data.manualPriceOverride).toDecimalPlaces(2);
    const updated = await prisma.order.update({
      where: { id },
      data: { manualPriceOverride: override },
    });

    await createAuditLog({
      userId: session.id,
      action: "price.changed",
      entityType: "Order",
      entityId: id,
      oldValues: { manualPriceOverride: order.manualPriceOverride },
      newValues: { manualPriceOverride: override },
      metadata: { note: parsed.data.note || null },
    });
    await notifyAdmins({
      type: "ORDER_PRICE_CHANGED",
      title: "Preis geaendert",
      message: `${order.orderNumber}: manueller Preis ${override.toString()} EUR netto.`,
    });

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
