import { NextRequest, NextResponse } from "next/server";
import { ErrorSeverity, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { completePaymentFromCheckoutSession, mockPaymentsEnabled } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const mockPaymentFlag = process.env.ENABLE_MOCK_PAYMENTS;
    if (mockPaymentFlag !== "true" && !mockPaymentsEnabled()) {
      return errorResponse("Mock-Zahlungen sind deaktiviert.", 404);
    }
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await context.params;
    const payment = await prisma.payment.findFirst({
      where: { id, order: { customer: { userId: session.id } } },
      include: { order: true },
    });
    if (!payment) return errorResponse("Testzahlung wurde nicht gefunden.", 404);
    if (payment.status === "PAID") return errorResponse("Diese Zahlung ist bereits abgeschlossen.", 409);

    const paid = await completePaymentFromCheckoutSession({
      id: payment.stripeCheckoutSessionId ?? `cs_mock_${payment.id}`,
      amount_total: Math.round(Number(payment.amount) * 100),
      currency: payment.currency.toLowerCase(),
      customer: payment.stripeCustomerId ?? `cus_mock_${session.id}`,
      payment_intent: payment.stripePaymentIntentId ?? `pi_mock_${payment.id}`,
      metadata: { orderId: payment.orderId, paymentId: payment.id, mock: "true" },
    } as never);

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/customer/orders/${payment.orderId}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: paid });
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.HIGH,
      source: "payment.mock_complete",
      fallbackMessage: "Mock-Zahlung fehlgeschlagen.",
    });
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Mock-Zahlung fehlgeschlagen.", 400);
    }
  }
}
