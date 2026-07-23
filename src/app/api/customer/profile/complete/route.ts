import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireTenantSession } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { createCheckoutForOrder, CustomerProfileIncompleteError } from "@/lib/payments";
import { errorResponse, readBody, routeErrorResponse, validationErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { customerProfileCompletionSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const parsed = customerProfileCompletionSchema.safeParse(await readBody(request));
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const data = parsed.data;
    const profile = await prisma.customerProfile.findFirst({
      where: { userId: session.id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!profile) return errorResponse("Kundenprofil wurde nicht gefunden.", 404);

    const order = await prisma.order.findFirst({
      where: {
        id: data.orderId,
        tenantId: session.tenantId,
        customerId: profile.id,
      },
      select: { id: true, orderNumber: true },
    });
    if (!order) return errorResponse("Auftrag wurde nicht gefunden.", 404);

    await prisma.customerProfile.update({
      where: { id: profile.id },
      data: {
        companyName: data.companyName,
        contactName: data.contactName,
        phone: data.phone,
        billingAddress: {
          street: data.billingStreet,
          houseNumber: data.billingHouseNumber || null,
          postalCode: data.billingPostalCode,
          city: data.billingCity,
          country: "DE",
        } satisfies Prisma.InputJsonValue,
        vatId: data.vatId || null,
      },
    });

    await createAuditLog({
      userId: session.id,
      tenantId: session.tenantId,
      action: "customer.profile_completed",
      entityType: "CustomerProfile",
      entityId: profile.id,
      newValues: { orderId: order.id, orderNumber: order.orderNumber, completedFields: ["companyName", "contactName", "phone", "billingAddress", "vatId"] },
    });

    const payment = await createCheckoutForOrder({
      orderId: order.id,
      customerUserId: session.id,
      tenantId: session.tenantId,
    });

    return Response.json({
      ok: true,
      data: {
        orderId: order.id,
        checkoutUrl: payment.checkoutUrl,
        redirectTo: payment.checkoutUrl || `/customer/orders/${order.id}`,
      },
    });
  } catch (error) {
    if (error instanceof CustomerProfileIncompleteError) {
      return Response.json({
        ok: false,
        code: error.code,
        error: "Bitte vervollständige deine Rechnungsdaten.",
        data: {
          missingFields: error.missingFields,
          orderId: error.orderId,
          redirectTo: `/customer/profile/complete?orderId=${encodeURIComponent(error.orderId)}`,
        },
      }, { status: 422 });
    }
    return routeErrorResponse(error);
  }
}
