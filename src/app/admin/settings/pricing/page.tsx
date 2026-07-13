import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import { revalidatePath } from "next/cache";
import { Prisma, ServiceType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncOpenOrderPrices, validatePricingRuleChanges } from "@/lib/pricing";
import { getPricingSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

async function savePricing(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.PRICING_MANAGE);
  const before = await getPricingSettings();
  const ids = formData.getAll("ruleId").map(String);
  const validationError = await validatePricingRuleChanges(ids.map((id) => ({
    id,
    serviceType: ServiceType.FLYER_DISTRIBUTION,
    minQuantity: Number(formData.get(`minQuantity-${id}`)),
    maxQuantity: formData.get(`maxQuantity-${id}`) ? Number(formData.get(`maxQuantity-${id}`)) : null,
    minimumNetPrice: String(formData.get(`minimumNetPrice-${id}`) ?? "0"),
    pricePerUnit: String(formData.get(`pricePerUnit-${id}`) ?? "0"),
    basePrice: String(formData.get(`basePrice-${id}`) ?? "0"),
    isActive: formData.get(`isActive-${id}`) === "on",
  })));
  if (validationError) throw new Error(validationError);

  await prisma.$transaction(async (tx) => {
    for (const key of Object.values(PRICING_SETTING_KEYS)) {
      const value = formData.get(key);
      if (value !== null) {
        await tx.pricingSetting.upsert({
          where: { key },
          update: { valueDecimal: new Prisma.Decimal(String(value)) },
          create: { key, valueDecimal: new Prisma.Decimal(String(value)), description: `Admin Setting ${key}` },
        });
      }
    }
    for (const id of ids) {
      await tx.pricingRule.update({
        where: { id },
        data: {
          minimumNetPrice: new Prisma.Decimal(String(formData.get(`minimumNetPrice-${id}`) ?? "0")),
          pricePerUnit: new Prisma.Decimal(String(formData.get(`pricePerUnit-${id}`) ?? "0")),
          basePrice: new Prisma.Decimal(String(formData.get(`basePrice-${id}`) ?? "0")),
          isActive: formData.get(`isActive-${id}`) === "on",
        },
      });
    }
  });
  await syncOpenOrderPrices();
  const after = await getPricingSettings();
  await createAuditLog({ userId: session.id, action: "settings.pricing_updated", entityType: "Pricing", entityId: "pricing", oldValues: before, newValues: after });
  await notifyAdmins({ type: "PRICING_CHANGED", title: "Preisregel geaendert", message: "Preisregeln wurden aktualisiert." });
  revalidatePath("/admin/settings/pricing");
  revalidatePath("/preise");
  revalidatePath("/customer/orders");
  revalidatePath("/customer/dashboard");
  revalidatePath("/customer/orders/[id]", "page");
}

export default async function PricingSettingsPage() {
  await requirePermission(Permission.PRICING_MANAGE);
  const { settings, rules } = await getPricingSettings();
  const settingValue = (key: string) => settings.find((setting) => setting.key === key)?.valueDecimal.toString() ?? "0";

  return (
    <AdminPortalShell eyebrow="Einstellungen" title="Preise">
      <form action={savePricing} className="panel stack widePanel">
        <div className="formGrid">
          <label>MwSt.<input name={PRICING_SETTING_KEYS.vatRate} defaultValue={settingValue(PRICING_SETTING_KEYS.vatRate)} /></label>
          <label>Expresszuschlag<input name={PRICING_SETTING_KEYS.expressSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.expressSurcharge)} /></label>
          <label>Foto-Nachweis Zuschlag<input name={PRICING_SETTING_KEYS.photoProofSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.photoProofSurcharge)} /></label>
          <label>Lagerzuschlag<input name={PRICING_SETTING_KEYS.warehouseSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.warehouseSurcharge)} /></label>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Staffel</th><th>Mindestpreis</th><th>Preis/Flyer</th><th>Basis</th><th>Aktiv</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.minQuantity}-{rule.maxQuantity ?? "unbegrenzt"}<input type="hidden" name="ruleId" value={rule.id} /><input type="hidden" name={`minQuantity-${rule.id}`} value={rule.minQuantity} /><input type="hidden" name={`maxQuantity-${rule.id}`} value={rule.maxQuantity ?? ""} /></td>
                  <td><input name={`minimumNetPrice-${rule.id}`} defaultValue={rule.minimumNetPrice.toString()} /></td>
                  <td><input name={`pricePerUnit-${rule.id}`} defaultValue={rule.pricePerUnit.toString()} /></td>
                  <td><input name={`basePrice-${rule.id}`} defaultValue={rule.basePrice.toString()} /></td>
                  <td><input name={`isActive-${rule.id}`} type="checkbox" defaultChecked={rule.isActive} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit">Speichern</button>
      </form>
    </AdminPortalShell>
  );
}
