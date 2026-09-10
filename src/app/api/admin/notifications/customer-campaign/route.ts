import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { productionCustomerWhere, productionUserWhere } from "@/lib/productionData";
import { publicUrl } from "@/lib/publicUrl";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

const CAMPAIGN_TYPE = "CUSTOMER_PROMOTION_CAMPAIGN";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
    const body = await readBody(request) as Record<string, unknown>;
    const subject = text(body.subject, 140);
    const title = text(body.title, 140);
    const campaignBody = text(body.body, 4000);
    const couponCode = text(body.couponCode, 64).toUpperCase();
    const idempotencyKey = text(body.idempotencyKey, 80);
    if (!subject || !title || !campaignBody) return errorResponse("Bitte Betreff, Überschrift und Nachricht ausfüllen.", 422);
    if (!/^[A-Z0-9_-]{3,64}$/.test(couponCode)) return errorResponse("Bitte einen gültigen Stripe-Promotion-Code mit 3–64 Zeichen eingeben.", 422);
    if (!idempotencyKey) return errorResponse("Die Kampagne konnte nicht eindeutig vorgemerkt werden. Bitte erneut versuchen.", 422);

    const existing = await prisma.customerEmailCampaign.findUnique({ where: { idempotencyKey } });
    if (existing) return successResponse({ campaignId: existing.id, status: existing.status, duplicate: true, recipientCount: existing.recipientCount, queuedCount: existing.queuedCount, skippedCount: existing.skippedCount });

    const campaign = await prisma.customerEmailCampaign.create({
      data: {
        idempotencyKey,
        tenantId: session.tenantId ?? null,
        createdById: session.id,
        subject,
        title,
        body: campaignBody,
        couponCode,
        campaignUrl: publicUrl("/customer/orders/new", request.url).toString(),
      },
    });

    const customers = await prisma.customerProfile.findMany({
      where: {
        ...productionCustomerWhere(),
        ...(session.tenantId ? { tenantId: session.tenantId } : {}),
        user: {
          ...productionUserWhere(),
          role: UserRole.CUSTOMER,
          status: "ACTIVE",
          emailVerified: { not: null },
          email: { not: "" },
        },
      },
      select: { id: true, companyName: true, contactName: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    let queuedCount = 0;
    let skippedCount = 0;
    for (const customer of customers) {
      const notification = await createNotification({
        userId: customer.user.id,
        type: CAMPAIGN_TYPE,
        title,
        message: campaignBody,
        data: {
          campaignId: campaign.id,
          campaignUrl: campaign.campaignUrl,
          couponCode,
          customerName: customer.contactName || customer.companyName,
          companyName: customer.companyName,
          nextStep: "Der Code wird im Stripe-Checkout eingegeben. Er gilt nur, wenn er in Stripe aktiv ist und die dort hinterlegten Bedingungen erfüllt sind.",
        },
        skipTemplate: true,
      });
      if (notification.queue) queuedCount += 1;
      else skippedCount += 1;
    }

    const updated = await prisma.customerEmailCampaign.update({
      where: { id: campaign.id },
      data: { recipientCount: customers.length, queuedCount, skippedCount, status: "QUEUED" },
    });
    return successResponse({ campaignId: updated.id, status: updated.status, recipientCount: updated.recipientCount, queuedCount: updated.queuedCount, skippedCount: updated.skippedCount, duplicate: false }, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
