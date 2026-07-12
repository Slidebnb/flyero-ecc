import { ErrorSeverity } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { createCheckoutForOrder } from "@/lib/payments";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await readBody(request);
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return errorResponse("orderId fehlt.", 400);

    const payment = await createCheckoutForOrder({ orderId, customerUserId: session.id, tenantId: session.tenantId });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(payment.checkoutUrl || new URL(`/customer/orders/${orderId}`, request.url), { status: 303 });
    }

    return Response.json({ ok: true, data: payment });
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.HIGH,
      source: "payment.checkout",
      fallbackMessage: "Checkout konnte nicht gestartet werden.",
    });
    return routeErrorResponse(error);
  }
}
