import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, errorResponse, successResponse } from "@/lib/request";
import { passwordResetSchema } from "@/lib/validators";
import { hashVerificationToken } from "@/lib/auth";
import { auditRequestContext } from "@/lib/auditRequestContext";
import { createAuditLog } from "@/lib/audit";
import { authRateLimitResponse, enforceAuthRateLimit } from "@/lib/authAbuseProtection";

const INVALID_TOKEN_MESSAGE = "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.";

export async function POST(request: NextRequest) {
  const decision = await enforceAuthRateLimit(request, "password-reset");
  if (!decision.allowed) return authRateLimitResponse(decision);

  const body = await readBody(request);
  const parsed = passwordResetSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Bitte gib ein gültiges neues Passwort ein.");

  const tokenHash = hashVerificationToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { status: true } } },
  });
  const now = new Date();

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now || resetToken.user.status !== "ACTIVE") {
    return errorResponse(INVALID_TOKEN_MESSAGE, 400);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("PASSWORD_RESET_TOKEN_ALREADY_USED");

      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await tx.authSession.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.passwordResetToken.updateMany({ where: { userId: resetToken.userId, usedAt: null }, data: { usedAt: now } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PASSWORD_RESET_TOKEN_ALREADY_USED") return errorResponse(INVALID_TOKEN_MESSAGE, 400);
    throw error;
  }

  await createAuditLog({
    userId: resetToken.userId,
    action: "auth.password_reset",
    entityType: "User",
    entityId: resetToken.userId,
    newValues: { sessionsRevoked: true },
    requestContext: auditRequestContext(request),
    result: "SUCCESS",
  });

  return successResponse({ message: "Dein Passwort wurde geändert. Du kannst dich jetzt einloggen." });
}
