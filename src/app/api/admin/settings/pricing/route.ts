import { NextRequest } from "next/server";
import { Prisma, ServiceType, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { ensureDefaultPricingSettings, getPricingSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN]);
    return successResponse(await getPricingSettings());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    await ensureDefaultPricingSettings();
    const body = await readBody(request) as Record<string, unknown>;
    const settings = body.settings as Record<string, unknown> | undefined;
    const rules = Array.isArray(body.rules) ? body.rules as Record<string, unknown>[] : [];

    const before = await getPricingSettings();
    if (settings) {
      for (const key of Object.values(PRICING_SETTING_KEYS)) {
        if (settings[key] !== undefined) {
          await prisma.pricingSetting.upsert({
            where: { key },
            update: { valueDecimal: new Prisma.Decimal(String(settings[key])) },
            create: { key, valueDecimal: new Prisma.Decimal(String(settings[key])), description: `Admin Setting ${key}` },
          });
        }
      }
    }

    for (const rule of rules) {
      const data = {
        serviceType: String(rule.serviceType ?? ServiceType.FLYER_DISTRIBUTION) as ServiceType,
        minQuantity: Number(rule.minQuantity),
        maxQuantity: rule.maxQuantity === null || rule.maxQuantity === "" || rule.maxQuantity === undefined ? null : Number(rule.maxQuantity),
        basePrice: new Prisma.Decimal(String(rule.basePrice ?? "0")),
        pricePerUnit: new Prisma.Decimal(String(rule.pricePerUnit ?? "0")),
        minimumNetPrice: new Prisma.Decimal(String(rule.minimumNetPrice ?? "0")),
        isActive: Boolean(rule.isActive),
      };
      if (rule.id) {
        await prisma.pricingRule.update({ where: { id: String(rule.id) }, data });
      } else {
        await prisma.pricingRule.create({ data });
      }
    }

    const after = await getPricingSettings();
    await createAuditLog({ userId: session.id, action: "settings.pricing_updated", entityType: "Pricing", entityId: "pricing", oldValues: before, newValues: after });
    await notifyAdmins({ type: "PRICING_CHANGED", title: "Preisregel geaendert", message: "Preisregeln wurden aktualisiert." });
    return successResponse(after);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
