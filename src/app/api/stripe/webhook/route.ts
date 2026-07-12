import { ErrorSeverity } from "@prisma/client";
import { auditRequestContext } from "@/lib/auditRequestContext";
import { handleStripeWebhook } from "@/lib/payments";
import { createErrorLogFromUnknown } from "@/lib/monitoring";
import { errorResponse } from "@/lib/request";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    const result = await handleStripeWebhook({ rawBody, signature, requestContext: auditRequestContext(request) });
    return Response.json({ ok: true, duplicate: result.duplicate, type: result.event.type });
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.CRITICAL,
      source: "stripe.webhook",
      fallbackMessage: "Stripe Webhook fehlgeschlagen.",
    });
    return errorResponse(error instanceof Error ? error.message : "Stripe Webhook fehlgeschlagen.", 400);
  }
}
