import { ErrorSeverity } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { createCheckoutForOrder, CustomerProfileIncompleteError } from "@/lib/payments";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await readBody(request);
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return errorResponse("orderId fehlt.", 400);
    const requestedIdempotencyKey = request.headers.get("idempotency-key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : "");
    if (requestedIdempotencyKey.length > 100) return errorResponse("Idempotency-Key ist zu lang.", 422);

    const payment = await createCheckoutForOrder({ orderId, customerUserId: session.id, tenantId: session.tenantId, idempotencyKey: requestedIdempotencyKey || undefined });
    for (const eventType of ["CHECKOUT_STARTED", "PAYMENT_REDIRECTED"]) {
      const existingEvent = await prisma.orderExperienceEvent.findFirst({
        where: { orderId, eventType, userId: session.id },
        select: { id: true },
      });
      if (!existingEvent) {
        await prisma.orderExperienceEvent.create({
          data: {
            orderId,
            customerId: payment.customerId,
            tenantId: session.tenantId,
            userId: session.id,
            eventType,
            source: "payment.checkout",
            metadata: { paymentId: payment.id },
          },
        });
      }
    }

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(payment.checkoutUrl || new URL(`/customer/orders/${orderId}`, request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: payment });
  } catch (error) {
    if (error instanceof CustomerProfileIncompleteError) {
      if (request.headers.get("accept")?.includes("text/html")) {
        return NextResponse.redirect(new URL(`/customer/profile/complete?orderId=${encodeURIComponent(error.orderId)}`, request.url), { status: 303 });
      }
      return Response.json({
        ok: false,
        code: error.code,
        error: "Bitte vervollständige deine Rechnungsdaten.",
        data: {
          missingFields: error.missingFields,
          orderId: error.orderId,
          redirectTo: `/customer/profile/complete?orderId=${encodeURIComponent(error.orderId)}`,
        },
      }, { status: 422 });
    }
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.HIGH,
      source: "payment.checkout",
      fallbackMessage: "Checkout konnte nicht gestartet werden.",
    });
    return routeErrorResponse(error);
  }
}
