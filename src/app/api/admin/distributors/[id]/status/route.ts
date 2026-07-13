import { DistributorReviewStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Permission, requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { adminDistributorUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
  const session = await requirePermission(Permission.DISTRIBUTOR_MANAGE);
  const { id } = await context.params;
  const parsed = adminDistributorUpdateSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
  }

  const profile = await prisma.distributorProfile.findUnique({
    where: { id },
    select: { id: true, userId: true, reviewStatus: true, adminNotes: true, approvedAt: true, rejectedAt: true },
  });

  if (!profile) {
    return errorResponse("Verteiler wurde nicht gefunden.", 404);
  }

  const now = new Date();
  const oldValues = {
    reviewStatus: profile.reviewStatus,
    adminNotes: profile.adminNotes,
  };
  const newValues = {
    reviewStatus: parsed.data.reviewStatus,
    adminNotes: parsed.data.adminNotes || null,
  };

  await prisma.distributorProfile.update({
    where: { id },
    data: {
      reviewStatus: parsed.data.reviewStatus as DistributorReviewStatus,
      adminNotes: parsed.data.adminNotes || null,
      approvedAt: parsed.data.reviewStatus === "APPROVED" ? now : profile.approvedAt,
      rejectedAt: parsed.data.reviewStatus === "REJECTED" ? now : profile.rejectedAt,
    },
  });

  await createAuditLog({
    userId: session.id,
    action: "admin.distributor_status_changed",
    entityType: "DistributorProfile",
    entityId: profile.id,
    oldValues,
    newValues,
    metadata: { distributorUserId: profile.userId },
  });

  await createNotification({
    userId: profile.userId,
    type:
      parsed.data.reviewStatus === "APPROVED"
        ? "DISTRIBUTOR_APPROVED"
        : parsed.data.reviewStatus === "REJECTED"
          ? "DISTRIBUTOR_REJECTED"
          : "DISTRIBUTOR_STATUS_CHANGED",
    title:
      parsed.data.reviewStatus === "APPROVED"
        ? "Profil freigegeben"
        : parsed.data.reviewStatus === "REJECTED"
          ? "Profil abgelehnt"
          : "Profilstatus geaendert",
    message:
      parsed.data.reviewStatus === "APPROVED"
        ? "Du bist jetzt als Verteiler freigegeben."
        : "Dein Verteilerstatus wurde aktualisiert.",
  });

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL(`/admin/distributors/${id}`, request.url), {
      status: 303,
    });
  }

  return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
