import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, errorResponse, successResponse } from "@/lib/request";
import { passwordResetRequestSchema } from "@/lib/validators";
import { authRateLimitResponse, enforceAuthRateLimit } from "@/lib/authAbuseProtection";
import { createPasswordResetToken, invalidatePasswordResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/verificationEmail";
import { auditRequestContext } from "@/lib/auditRequestContext";
import { createAuditLog } from "@/lib/audit";

const GENERIC_MESSAGE = "Wenn zu dieser E-Mail ein aktives Konto existiert, senden wir dir einen Link zum Zurücksetzen deines Passworts.";

export async function POST(request: NextRequest) {
  const decision = await enforceAuthRateLimit(request, "password-reset");
  if (!decision.allowed) return authRateLimitResponse(decision);

  const body = await readBody(request);
  const parsed = passwordResetRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Bitte gib eine gültige E-Mail-Adresse ein.");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return successResponse({ message: GENERIC_MESSAGE });
  }

  const context = auditRequestContext(request);
  const resetToken = await createPasswordResetToken(user.id);

  try {
    await sendPasswordResetEmail({ email: user.email, token: resetToken.token, requestUrl: request.url });
    await createAuditLog({
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { channel: "email" },
      requestContext: context,
      result: "SUCCESS",
    });
  } catch (error) {
    await invalidatePasswordResetToken(resetToken.tokenId);
    await createAuditLog({
      userId: user.id,
      action: "auth.password_reset_requested",
      entityType: "User",
      entityId: user.id,
      metadata: { channel: "email", reason: "delivery_failed" },
      requestContext: context,
      result: "FAILURE",
    });
    if (process.env.NODE_ENV !== "test") console.error("Password reset email delivery failed", error instanceof Error ? error.message : "unknown error");
  }

  return successResponse({ message: GENERIC_MESSAGE });
}
