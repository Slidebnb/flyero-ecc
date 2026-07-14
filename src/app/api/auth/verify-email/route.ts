import { UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashVerificationToken } from "@/lib/auth";
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
  const token = typeof body.token === "string" ? body.token : "";

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

  const user = await prisma.$transaction(async (tx) => {
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
      await tx.distributorProfile.update({
        where: { userId: updatedUser.id },
        data: { reviewStatus: "PENDING_REVIEW" },
      });
    }

    return updatedUser;
  });

  await createAuditLog({
    userId: user.id,
    action: "auth.email_verified",
    entityType: "User",
    entityId: user.id,
    oldValues: { status: verificationToken.user.status },
    newValues: { status: user.status, emailVerified: user.emailVerified },
  });
  await prisma.orderExperienceEvent.create({
    data: {
      customerId: user.customerProfile?.id ?? null,
      tenantId: user.customerProfile?.tenantId ?? user.tenantId,
      userId: user.id,
      eventType: "EMAIL_VERIFIED",
      source: "auth.email-verification",
      metadata: { role: user.role },
    },
  });
  await createNotification({
    userId: user.id,
    type: "EMAIL_VERIFIED",
    title: "E-Mail bestätigt",
    message:
      user.role === "DISTRIBUTOR"
        ? "Dein Profil wird jetzt geprüft."
        : "Dein Kundenkonto ist jetzt aktiv.",
  });

  if (user.role === "DISTRIBUTOR") {
    await notifyAdmins({
      type: "DISTRIBUTOR_PENDING_REVIEW",
      title: "Verteiler wartet auf Prüfung",
      message: `${user.email} hat die E-Mail bestätigt und wartet auf Freigabe.`,
    });
  }

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
