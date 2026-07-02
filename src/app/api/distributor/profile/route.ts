import { DistributorReviewStatus, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { distributorProfileUpdateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const parsed = distributorProfileUpdateSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
  }

  const data = parsed.data;
  const profile = await prisma.distributorProfile.findUnique({
    where: { userId: session.id },
  });

  if (!profile) {
    return errorResponse("Verteilerprofil wurde nicht gefunden.", 404);
  }

  const oldValues = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    address: profile.address,
    federalState: profile.federalState,
    mobilityTypes: profile.mobilityTypes,
    preferredAreas: profile.preferredAreas,
    availability: profile.availability,
    workingTimes: profile.workingTimes,
    serviceRadiusKm: profile.serviceRadiusKm,
    taxNumber: profile.taxNumber,
    bankAccount: profile.bankAccount,
    reviewStatus: profile.reviewStatus,
  };

  const shouldReturnToReview =
    profile.reviewStatus === DistributorReviewStatus.APPROVED ||
    profile.reviewStatus === DistributorReviewStatus.REJECTED;

  const newValues = {
    firstName: data.firstName,
    lastName: data.lastName,
    birthDate: data.birthDate,
    phone: data.phone,
    mobilityType: data.mobilityTypes[0],
    mobilityTypes: data.mobilityTypes,
    preferredAreas: data.preferredAreas,
    availability: { days: data.availabilityDays },
    workingTimes: data.workingTimes,
    serviceRadiusKm: data.serviceRadiusKm,
    taxNumber: data.taxNumber || null,
    bankAccount:
      data.bankAccountOwner || data.iban
        ? { owner: data.bankAccountOwner || null, iban: data.iban || null }
        : Prisma.JsonNull,
    address: {
      street: data.street,
      houseNumber: data.houseNumber,
      postalCode: data.postalCode,
      city: data.city,
      federalState: data.federalState,
      country: "DE",
    },
    federalState: data.federalState,
    reviewStatus: shouldReturnToReview
      ? DistributorReviewStatus.PENDING_REVIEW
      : profile.reviewStatus,
  };

  await prisma.distributorProfile.update({
    where: { userId: session.id },
    data: newValues,
  });

  await createAuditLog({
    userId: session.id,
    action: "distributor.profile_updated",
    entityType: "DistributorProfile",
    entityId: profile.id,
    oldValues,
    newValues,
  });
  await createNotification({
    userId: session.id,
    type: "PROFILE_UPDATED",
    title: "Profil aktualisiert",
    message: shouldReturnToReview
      ? "Dein Profil wurde gespeichert und wird erneut geprueft."
      : "Dein Verteilerprofil wurde gespeichert.",
  });

  if (shouldReturnToReview) {
    await notifyAdmins({
      type: "DISTRIBUTOR_PENDING_REVIEW",
      title: "Verteilerprofil geaendert",
      message: `${profile.firstName} ${profile.lastName} wartet erneut auf Pruefung.`,
    });
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/distributor/profile", request.url), {
      status: 303,
    });
  }

  return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
