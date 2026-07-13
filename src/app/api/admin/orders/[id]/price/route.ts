import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { calculatePriceFromNet, getVatRate } from "@/lib/pricing";
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
      include: {
        customer: { select: { userId: true } },
        payments: { where: { status: { in: ["CHECKOUT_CREATED", "PENDING", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } },
      },
    });
    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }
    if (order.payments.length > 0) {
      return errorResponse("Der Preis kann nach gestarteter oder erfolgreicher Zahlung nicht mehr geaendert werden.", 409);
    }

    const override = new Prisma.Decimal(parsed.data.manualPriceOverride).toDecimalPlaces(2);
    const currentSnapshot = order.priceRuleSnapshot && typeof order.priceRuleSnapshot === "object" && !Array.isArray(order.priceRuleSnapshot)
      ? order.priceRuleSnapshot as Record<string, unknown>
      : {};
    const manualVatRate = await getVatRate();
    const manualPrice = calculatePriceFromNet(override, manualVatRate);
    const updated = await prisma.order.update({
      where: { id },
      data: {
        manualPriceOverride: override,
        calculatedNetPrice: manualPrice.net,
        calculatedVat: manualPrice.vat,
        calculatedGrossPrice: manualPrice.gross,
        priceRuleSnapshot: {
          ...currentSnapshot,
          manualPriceOverride: override.toString(),
          manualVatRate: manualVatRate.toString(),
          manualVat: manualPrice.vat.toString(),
          manualCalculatedGross: manualPrice.gross.toString(),
          customerFacingPriceLabel: "Individuelles Angebot",
          manualPriceNote: parsed.data.note || null,
          manualPriceUpdatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    await createAuditLog({
      userId: session.id,
      action: "price.changed",
      entityType: "Order",
      entityId: id,
      tenantId: order.tenantId,
      oldValues: { manualPriceOverride: order.manualPriceOverride },
      newValues: { manualPriceOverride: override },
      metadata: { note: parsed.data.note || null },
    });
    await notifyAdmins({
      type: "ORDER_PRICE_CHANGED",
      title: "Preis geaendert",
      message: `${order.orderNumber}: manueller Preis ${override.toString()} EUR netto.`,
    });
    await createNotification({
      userId: order.customer.userId,
      type: "ORDER_PRICE_UPDATED",
      title: "Preis fuer deine Kampagne aktualisiert",
      message: `Der Preis fuer ${order.orderNumber} wurde von FLYERO aktualisiert. Die neue Preisgrundlage findest du direkt im Kundenportal.`,
      data: { orderNumber: order.orderNumber, paymentAmount: manualPrice.gross.toString(), paymentNet: override.toString() },
    });
    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    revalidatePath(`/customer/orders/${id}`);

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
