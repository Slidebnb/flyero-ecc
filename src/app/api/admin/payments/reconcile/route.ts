import { timingSafeEqual } from "node:crypto";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse } from "@/lib/request";
import { runStripeReconciliation } from "@/lib/paymentReconciliation";

export async function POST(request: Request) {
  try {
    const configuredToken = process.env.INTERNAL_API_TOKEN?.trim();
    const providedToken = request.headers.get("x-internal-api-token")?.trim() || "";
    const internalCall = Boolean(
      configuredToken &&
      providedToken &&
      configuredToken.length === providedToken.length &&
      timingSafeEqual(Buffer.from(configuredToken), Buffer.from(providedToken)),
    );
    const session = internalCall ? null : await requirePermission(Permission.PAYMENT_RECONCILE);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "500");
    const result = await runStripeReconciliation({ actorId: session?.id ?? null, limit, dryRun: true });
    return Response.json({ ok: true, data: result });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
