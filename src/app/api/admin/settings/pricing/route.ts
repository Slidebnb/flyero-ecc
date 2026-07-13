import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma, ServiceType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { syncOpenOrderPrices, validatePricingRuleChanges } from "@/lib/pricing";
import { ensureDefaultPricingSettings, getPricingSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

export async function GET() {
  try {
    await requirePermission(Permission.PRICING_MANAGE);
    return successResponse(await getPricingSettings());
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.PRICING_MANAGE);
    await ensureDefaultPricingSettings();
    const body = await readBody(request) as Record<string, unknown>;
    const settings = body.settings as Record<string, unknown> | undefined;
    const rules = Array.isArray(body.rules) ? body.rules as Record<string, unknown>[] : [];

    if (rules.length) {
      const validationError = await validatePricingRuleChanges(rules.map((rule) => ({
        id: rule.id ? String(rule.id) : undefined,
        serviceType: String(rule.serviceType ?? ServiceType.FLYER_DISTRIBUTION) as ServiceType,
        minQuantity: Number(rule.minQuantity),
        maxQuantity: rule.maxQuantity === null || rule.maxQuantity === "" || rule.maxQuantity === undefined ? null : Number(rule.maxQuantity),
        basePrice: String(rule.basePrice ?? "0"),
        pricePerUnit: String(rule.pricePerUnit ?? "0"),
        minimumNetPrice: String(rule.minimumNetPrice ?? "0"),
        isActive: Boolean(rule.isActive),
      })));
      if (validationError) return errorResponse(validationError, 422);
    }

    const before = await getPricingSettings();
    await prisma.$transaction(async (tx) => {
      if (settings) {
        for (const key of Object.values(PRICING_SETTING_KEYS)) {
          if (settings[key] !== undefined) {
            await tx.pricingSetting.upsert({
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
          await tx.pricingRule.update({ where: { id: String(rule.id) }, data });
        } else {
          await tx.pricingRule.create({ data });
        }
      }
    });

    const after = await getPricingSettings();
    const propagated = await syncOpenOrderPrices();
    await createAuditLog({ userId: session.id, action: "settings.pricing_updated", entityType: "Pricing", entityId: "pricing", oldValues: before, newValues: after });
    await notifyAdmins({ type: "PRICING_CHANGED", title: "Preisregel geaendert", message: "Preisregeln wurden aktualisiert." });
    revalidatePath("/admin/settings/pricing");
    revalidatePath("/preise");
    revalidatePath("/customer/dashboard");
    revalidatePath("/customer/orders");
    revalidatePath("/customer/orders/[id]", "page");
    return successResponse({ ...after, propagatedOpenOrders: propagated.updatedCount });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
