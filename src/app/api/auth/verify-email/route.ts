import { DistributorReviewStatus, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, hashVerificationToken } from "@/lib/auth";
import { readBody, errorResponse } from "@/lib/request";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { publicUrl } from "@/lib/publicUrl";
import { authRateLimitResponse, enforceAuthRateLimit } from "@/lib/authAbuseProtection";
import { roleContinuationFallback, safeInternalRedirectPath } from "@/lib/redirects";

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const abuseDecision = await enforceAuthRateLimit(request, "verify");
  if (!abuseDecision.allowed) return authRateLimitResponse(abuseDecision);
  const token = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).token === "string"
    ? String((body as Record<string, unknown>).token)
    : "";

  if (!token) {
    return errorResponse("Verifizierungstoken fehlt.");
  }

  const tokenHash = hashVerificationToken(token);
  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, role: true, status: true } } },
  });

  if (
    !verificationToken ||
    verificationToken.usedAt ||
    verificationToken.expiresAt < new Date()
  ) {
    return errorResponse("Verifizierungstoken ist ungültig oder abgelaufen.", 400);
  }

  if (verificationToken.user.status === UserStatus.DISABLED || verificationToken.user.status === UserStatus.BANNED) {
    return errorResponse("Dieses Benutzerkonto ist gesperrt und kann nicht aktiviert werden.", 403);
  }

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: verificationToken.userId },
      include: { distributorProfile: true, customerProfile: { select: { id: true, tenantId: true } } },
    });
    if (!currentUser) throw new Error("Benutzerkonto wurde nicht gefunden.");
    if (currentUser.status === UserStatus.DISABLED || currentUser.status === UserStatus.BANNED) {
      throw new AuthError("Dieses Benutzerkonto ist gesperrt und kann nicht aktiviert werden.", 403);
    }

    await tx.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    const updatedUser = await tx.user.update({
      where: { id: verificationToken.userId },
      data: {
        status: UserStatus.ACTIVE,
        emailVerified: new Date(),
      },
      include: { distributorProfile: true, customerProfile: { select: { id: true, tenantId: true } } },
    });

    if (updatedUser.distributorProfile) {
      const reviewStatus = updatedUser.distributorProfile.reviewStatus;
      if (reviewStatus !== DistributorReviewStatus.PAUSED && reviewStatus !== DistributorReviewStatus.BANNED) {
        await tx.distributorProfile.update({
          where: { userId: updatedUser.id },
          data: { reviewStatus: DistributorReviewStatus.PENDING_REVIEW },
        });
      }
    }

    return updatedUser;
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.status);
    }
    throw error;
  }

  const verificationSideEffects: Promise<unknown>[] = [
    createAuditLog({
      userId: user.id,
      action: "auth.email_verified",
      entityType: "User",
      entityId: user.id,
      oldValues: { status: verificationToken.user.status },
      newValues: { status: user.status, emailVerified: user.emailVerified },
    }),
    prisma.orderExperienceEvent.create({
      data: {
        customerId: user.customerProfile?.id ?? null,
        tenantId: user.customerProfile?.tenantId ?? user.tenantId,
        userId: user.id,
        eventType: "EMAIL_VERIFIED",
        source: "auth.email-verification",
        metadata: { role: user.role },
      },
    }),
    createNotification({
      userId: user.id,
      type: "EMAIL_VERIFIED",
      title: "E-Mail bestätigt",
      message:
        user.role === "DISTRIBUTOR"
          ? "Dein Profil wird jetzt geprüft."
          : "Dein Kundenkonto ist jetzt aktiv.",
    }),
  ];

  if (user.role === "DISTRIBUTOR") {
    verificationSideEffects.push(notifyAdmins({
      type: "DISTRIBUTOR_PENDING_REVIEW",
      title: "Verteiler wartet auf Prüfung",
      message: `${user.email} hat die E-Mail bestätigt und wartet auf Freigabe.`,
    }));
  }

  await Promise.allSettled(verificationSideEffects);

  const continuationPath = safeInternalRedirectPath(
    verificationToken.redirectPath,
    roleContinuationFallback(user.role),
  );
  const redirectTo = `/login?next=${encodeURIComponent(continuationPath)}`;

  if (request.headers.get("accept")?.includes("text/html")) {
    const loginUrl = publicUrl("/login", request.url);
    loginUrl.searchParams.set("next", continuationPath);
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  return Response.json({
    ok: true,
    data: {
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      redirectTo,
    },
  });
}
