import bcrypt from "bcryptjs";
import { DistributorReviewStatus, Prisma, UserRole, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, errorResponse } from "@/lib/request";
import { distributorRegisterSchema } from "@/lib/validators";
import {
  createVerificationToken,
  hashVerificationToken,
} from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { publicUrl } from "@/lib/publicUrl";
import { sendVerificationEmail } from "@/lib/verificationEmail";

export async function POST(request: NextRequest) {
  const parsed = distributorRegisterSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Ungültige Eingabe.");
  }

  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 12);
  const verificationToken = createVerificationToken();
  const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  try {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: UserRole.DISTRIBUTOR,
        status: UserStatus.EMAIL_UNVERIFIED,
        distributorProfile: {
          create: {
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
                ? {
                    owner: data.bankAccountOwner || null,
                    iban: data.iban || null,
                  }
                : undefined,
            reviewStatus: DistributorReviewStatus.REGISTERED,
            address: {
              street: data.street,
              houseNumber: data.houseNumber,
              postalCode: data.postalCode,
              city: data.city,
              federalState: data.federalState,
              country: "DE",
            },
            federalState: data.federalState,
          },
        },
        emailVerificationTokens: {
          create: {
            tokenHash: hashVerificationToken(verificationToken),
            expiresAt: verificationExpiresAt,
          },
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "distributor.registered",
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });
    await createNotification({
      userId: user.id,
      type: "DISTRIBUTOR_REGISTERED",
      title: "Verteilerkonto erstellt",
      message: "Bitte bestätige deine E-Mail-Adresse. Danach prüft ein Admin dein Profil.",
    });
    await notifyAdmins({
      type: "DISTRIBUTOR_REGISTERED",
      title: "Neuer Verteiler registriert",
      message: `${data.firstName} ${data.lastName} wartet nach E-Mail-Bestätigung auf Prüfung.`,
    });
    const verificationDelivery = await sendVerificationEmail({
      email: user.email,
      token: verificationToken,
      requestUrl: request.url,
    }).then(
      () => ({ sent: true, error: null }),
      (error) => ({ sent: false, error: error instanceof Error ? error.message : "Versand fehlgeschlagen" }),
    );

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(publicUrl("/login", request.url), { status: 303 });
    }

    return Response.json(
      {
        ok: true,
        data: {
          userId: user.id,
          role: user.role,
          verificationEmailSent: verificationDelivery.sent,
          verificationEmailError: verificationDelivery.sent ? undefined : verificationDelivery.error,
          verificationToken:
            process.env.NODE_ENV === "production" ? undefined : verificationToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return errorResponse("Diese E-Mail-Adresse ist bereits registriert.", 409);
    }

    throw error;
  }
}
