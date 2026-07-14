import { UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, errorResponse } from "@/lib/request";
import { hashVerificationToken } from "@/lib/auth";
import { createEmailVerificationToken, sendVerificationEmail } from "@/lib/verificationEmail";
import { authRateLimitResponse, enforceAuthRateLimit } from "@/lib/authAbuseProtection";
import { roleContinuationFallback, safeInternalRedirectPath } from "@/lib/redirects";

function emailFromBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>).email;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function tokenFromBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>).token;
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const email = emailFromBody(body);
  const token = tokenFromBody(body);
  const requestedNext = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).next
    : undefined;

  const abuseDecision = await enforceAuthRateLimit(request, "resend", email);
  if (!abuseDecision.allowed) return authRateLimitResponse(abuseDecision);

  if (!email || !email.includes("@")) {
    return errorResponse("Bitte gib eine gültige E-Mail-Adresse ein.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true, role: true },
  });

  if (!user) {
    return Response.json({
      ok: true,
      data: {
        sent: false,
        message: "Wenn zu dieser E-Mail ein offenes Konto existiert, senden wir einen neuen Bestätigungslink.",
      },
    });
  }

  if (user.status !== UserStatus.EMAIL_UNVERIFIED) {
    return Response.json({
      ok: true,
      data: {
        sent: false,
        alreadyVerified: true,
        message: "Diese E-Mail-Adresse ist bereits bestätigt. Du kannst dich direkt einloggen.",
      },
    });
  }

  const previousToken = token
    ? await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashVerificationToken(token) }, select: { userId: true, redirectPath: true } })
    : null;
  const latestToken = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { redirectPath: true },
  });
  const redirectPath = safeInternalRedirectPath(
    requestedNext || (previousToken?.userId === user.id ? previousToken.redirectPath : null) || latestToken?.redirectPath,
    roleContinuationFallback(user.role),
  );
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const { verificationToken } = await createEmailVerificationToken(user.id, redirectPath);
  await sendVerificationEmail({ email: user.email, token: verificationToken, requestUrl: request.url });

  return Response.json({
    ok: true,
    data: {
      sent: true,
      message: "Wir haben dir einen neuen Bestätigungslink gesendet.",
      verificationToken: process.env.NODE_ENV === "production" ? undefined : verificationToken,
    },
  });
}
