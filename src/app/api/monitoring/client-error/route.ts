import { ErrorSeverity } from "@prisma/client";
import { NextRequest } from "next/server";
import { createErrorLog } from "@/lib/monitoring";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { readBody, routeErrorResponse } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const decision = await enforcePublicRateLimit(request, "client-error");
    if (!decision.allowed) return publicRateLimitResponse(decision);
    const body = (await readBody(request)) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.slice(0, 500) : "Client Error Boundary";
    const digest = typeof body.digest === "string" ? body.digest.slice(0, 120) : undefined;
    const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 300) : undefined;

    await createErrorLog({
      severity: ErrorSeverity.HIGH,
      source: "app.error_boundary",
      message,
      metadata: { digest, pathname },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
