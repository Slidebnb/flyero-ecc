import bcrypt from "bcryptjs";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody, errorResponse } from "@/lib/request";
import { customerRegisterSchema } from "@/lib/validators";
import {
  createVerificationToken,
  hashVerificationToken,
} from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { publicUrl } from "@/lib/publicUrl";
import { sendVerificationEmail } from "@/lib/verificationEmail";
import { authRateLimitResponse, enforceAuthRateLimit } from "@/lib/authAbuseProtection";
import { createCustomerTenant } from "@/lib/tenant";

function safeNext(value: unknown) {
  if (typeof value !== "string") return "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  const abuseDecision = await enforceAuthRateLimit(request, "register");
  if (!abuseDecision.allowed) return authRateLimitResponse(abuseDecision);
  const parsed = customerRegisterSchema.safeParse(body);
  const next = safeNext((body as Record<string, unknown>).next || request.nextUrl.searchParams.get("next"));

  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message || "Ungültige Eingabe.");
  }

  const data = parsed.data;
  const passwordHash = await bcrypt.hash(data.password, 12);
  const verificationToken = createVerificationToken();
  const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const tenant = await createCustomerTenant(tx, data.companyName);
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: UserRole.CUSTOMER,
          status: UserStatus.EMAIL_UNVERIFIED,
          tenantId: tenant.id,
          customerProfile: {
            create: {
              tenantId: tenant.id,
            companyName: data.companyName,
            contactName: data.contactName,
            phone: data.phone,
            vatId: data.vatId || null,
            logoUrl: data.logoUrl || null,
            billingAddress: {
              street: data.billingStreet,
              houseNumber: data.billingHouseNumber || null,
              postalCode: data.billingPostalCode,
              city: data.billingCity,
              country: "DE",
            },
            deliveryAddress: data.deliveryStreet
              ? {
                  street: data.deliveryStreet,
                  houseNumber: data.deliveryHouseNumber || null,
                  postalCode: data.deliveryPostalCode || null,
                  city: data.deliveryCity || null,
                  country: "DE",
                }
              : undefined,
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
      await tx.tenantMembership.create({
        data: { tenantId: tenant.id, userId: createdUser.id, role: "OWNER", status: "ACTIVE" },
      });
      return createdUser;
    });

    await createAuditLog({
      userId: user.id,
      action: "customer.registered",
      entityType: "User",
      entityId: user.id,
      newValues: { email: user.email, role: user.role },
    });
    await createNotification({
      userId: user.id,
      type: "CUSTOMER_REGISTERED",
      title: "Kundenkonto erstellt",
      message: "Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
    });
    await notifyAdmins({
      type: "CUSTOMER_REGISTERED",
      title: "Neuer Kunde registriert",
      message: `${data.companyName} hat ein Kundenkonto erstellt.`,
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
      const loginUrl = publicUrl("/login", request.url);
      if (next) loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl, { status: 303 });
    }

    return Response.json(
      {
        ok: true,
        data: {
          userId: user.id,
          role: user.role,
          redirectTo: next ? `/login?next=${encodeURIComponent(next)}` : "/login",
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
