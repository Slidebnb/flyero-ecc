import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantSession } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { errorResponse, readBody, routeErrorResponse, validationErrorResponse } from "@/lib/request";
import { customerProfileUpdateSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
  const session = await requireTenantSession();
  const parsed = customerProfileUpdateSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { customerProfile: true },
  });

  if (!user?.customerProfile || user.customerProfile.tenantId !== session.tenantId) {
    return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      return errorResponse("Aktuelles Passwort ist erforderlich.");
    }

    const passwordMatches = await bcrypt.compare(
      data.currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return errorResponse("Aktuelles Passwort ist falsch.", 403);
    }
  }

  const oldValues = {
    companyName: user.customerProfile.companyName,
    contactName: user.customerProfile.contactName,
    phone: user.customerProfile.phone,
    billingAddress: user.customerProfile.billingAddress,
    deliveryAddress: user.customerProfile.deliveryAddress,
    vatId: user.customerProfile.vatId,
    logoUrl: user.customerProfile.logoUrl,
  };

  const newValues = {
    companyName: data.companyName,
    contactName: data.contactName,
    phone: data.phone,
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
      : Prisma.JsonNull,
    vatId: data.vatId || null,
    logoUrl: data.logoUrl || null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.customerProfile.updateMany({
      where: { userId: session.id, tenantId: session.tenantId },
      data: newValues,
    });

    if (data.newPassword) {
      await tx.user.update({
        where: { id: session.id },
        data: { passwordHash: await bcrypt.hash(data.newPassword, 12) },
      });
    }
  });

  await createAuditLog({
    userId: session.id,
    action: "customer.profile_updated",
    entityType: "CustomerProfile",
    entityId: user.customerProfile.id,
    oldValues,
    newValues,
    metadata: { passwordChanged: Boolean(data.newPassword) },
    tenantId: session.tenantId,
  });
  await createNotification({
    userId: session.id,
    type: "PROFILE_UPDATED",
    title: "Profil aktualisiert",
    message: "Dein Kundenprofil wurde gespeichert.",
  });

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/customer/profile", request.url), {
      status: 303,
    });
  }

  return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
