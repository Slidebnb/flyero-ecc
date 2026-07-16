import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import { revalidatePath } from "next/cache";
import { Prisma, ServiceType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncOpenOrderPrices, validatePricingRuleChanges } from "@/lib/pricing";
import { getPricingSettings, PRICING_SETTING_KEYS } from "@/lib/settings";
import { serviceCatalogLabel } from "@/lib/serviceCatalog";
import { PricingSimulationForm } from "./PricingSimulationForm";

async function savePricing(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.PRICING_MANAGE);
  const before = await getPricingSettings();
  const ids = formData.getAll("ruleId").map(String);
  const existingRules = await prisma.pricingRule.findMany({ where: { id: { in: ids } }, select: { id: true, serviceType: true } });
  const serviceTypeById = new Map(existingRules.map((rule) => [rule.id, rule.serviceType]));
  const validationError = await validatePricingRuleChanges(ids.map((id) => ({
    id,
    serviceType: serviceTypeById.get(id) ?? ServiceType.FLYER_DISTRIBUTION,
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
          minQuantity: Number(formData.get(`minQuantity-${id}`)),
          maxQuantity: formData.get(`maxQuantity-${id}`) ? Number(formData.get(`maxQuantity-${id}`)) : null,
          minimumNetPrice: new Prisma.Decimal(String(formData.get(`minimumNetPrice-${id}`) ?? "0")),
          pricePerUnit: new Prisma.Decimal(String(formData.get(`pricePerUnit-${id}`) ?? "0")),
          basePrice: new Prisma.Decimal(String(formData.get(`basePrice-${id}`) ?? "0")),
          isActive: formData.get(`isActive-${id}`) === "on",
          pricingVersion: String(formData.get(`pricingVersion-${id}`) ?? "service-pricing-v1"),
          configurationVersion: String(formData.get(`configurationVersion-${id}`) ?? "pricing-config-v1"),
          notes: String(formData.get(`notes-${id}`) ?? "") || null,
          validFrom: formData.get(`validFrom-${id}`) ? new Date(String(formData.get(`validFrom-${id}`))) : null,
          validTo: formData.get(`validTo-${id}`) ? new Date(String(formData.get(`validTo-${id}`))) : null,
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
  const services = Object.values(ServiceType).map((value) => ({ value, label: serviceCatalogLabel(value) }));

  return (
    <AdminPortalShell eyebrow="Einstellungen" title="Preise">
      <form action={savePricing} className="panel stack widePanel">
        <div className="formGrid">
          <label>MwSt.<input name={PRICING_SETTING_KEYS.vatRate} defaultValue={settingValue(PRICING_SETTING_KEYS.vatRate)} /></label>
          <label>Expresszuschlag<input name={PRICING_SETTING_KEYS.expressSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.expressSurcharge)} /></label>
          <label>Foto-Nachweis Zuschlag<input name={PRICING_SETTING_KEYS.photoProofSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.photoProofSurcharge)} /></label>
          <label>Lagerzuschlag<input name={PRICING_SETTING_KEYS.warehouseSurcharge} defaultValue={settingValue(PRICING_SETTING_KEYS.warehouseSurcharge)} /></label>
        </div>
        <p className="sectionIntro">Service-Faktoren und Zuschläge werden netto gespeichert und bei neuen Quotes serverseitig angewendet.</p>
        <div className="formGrid">
          <label>Express unter 7 Tagen %<input name={PRICING_SETTING_KEYS.expressSurchargePercent} defaultValue={settingValue(PRICING_SETTING_KEYS.expressSurchargePercent)} /></label>
          <label>Express unter 72 Stunden %<input name={PRICING_SETTING_KEYS.express72hSurchargePercent} defaultValue={settingValue(PRICING_SETTING_KEYS.express72hSurchargePercent)} /></label>
          <label>Wochenende/Feiertag %<input name={PRICING_SETTING_KEYS.weekendSurchargePercent} defaultValue={settingValue(PRICING_SETTING_KEYS.weekendSurchargePercent)} /></label>
          <label>Weiteres Gebiet netto<input name={PRICING_SETTING_KEYS.additionalAreaFeeNet} defaultValue={settingValue(PRICING_SETTING_KEYS.additionalAreaFeeNet)} /></label>
          <label>Abholung netto<input name={PRICING_SETTING_KEYS.pickupFeeNet} defaultValue={settingValue(PRICING_SETTING_KEYS.pickupFeeNet)} /></label>
          <label>Lagerung je Einheit netto<input name={PRICING_SETTING_KEYS.storageFeeNet} defaultValue={settingValue(PRICING_SETTING_KEYS.storageFeeNet)} /></label>
          <label>Handling netto<input name={PRICING_SETTING_KEYS.handlingFeeNet} defaultValue={settingValue(PRICING_SETTING_KEYS.handlingFeeNet)} /></label>
          <label>Sampling-Handling/Stück<input name={PRICING_SETTING_KEYS.samplingHandlingFeePerUnit} defaultValue={settingValue(PRICING_SETTING_KEYS.samplingHandlingFeePerUnit)} /></label>
        </div>
        <div className="formGrid">
          <label>Gewicht LIGHT<input name={PRICING_SETTING_KEYS.weightLightFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.weightLightFactor)} /></label>
          <label>Gewicht STANDARD<input name={PRICING_SETTING_KEYS.weightStandardFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.weightStandardFactor)} /></label>
          <label>Gewicht MEDIUM<input name={PRICING_SETTING_KEYS.weightMediumFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.weightMediumFactor)} /></label>
          <label>Gewicht HEAVY<input name={PRICING_SETTING_KEYS.weightHeavyFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.weightHeavyFactor)} /></label>
          <label>Gebiet NORMAL<input name={PRICING_SETTING_KEYS.areaNormalFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.areaNormalFactor)} /></label>
          <label>Gebiet MIXED<input name={PRICING_SETTING_KEYS.areaMixedFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.areaMixedFactor)} /></label>
          <label>Gebiet LOW_DENSITY<input name={PRICING_SETTING_KEYS.areaLowDensityFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.areaLowDensityFactor)} /></label>
          <label>Gebiet RURAL<input name={PRICING_SETTING_KEYS.areaRuralFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.areaRuralFactor)} /></label>
          <label>Gebiet HARD<input name={PRICING_SETTING_KEYS.areaHardFactor} defaultValue={settingValue(PRICING_SETTING_KEYS.areaHardFactor)} /></label>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Leistung</th><th>Staffel</th><th>Mindestpreis netto</th><th>Preis/Stück</th><th>Basis</th><th>Version</th><th>Aktiv</th></tr></thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{serviceCatalogLabel(rule.serviceType)}</td>
                  <td><input name={`minQuantity-${rule.id}`} type="number" min="1" defaultValue={rule.minQuantity} /><span>–</span><input name={`maxQuantity-${rule.id}`} type="number" min="1" defaultValue={rule.maxQuantity ?? ""} placeholder="offen" /><input type="hidden" name="ruleId" value={rule.id} /></td>
                  <td><input name={`minimumNetPrice-${rule.id}`} defaultValue={rule.minimumNetPrice.toString()} /></td>
                  <td><input name={`pricePerUnit-${rule.id}`} defaultValue={rule.pricePerUnit.toString()} /></td>
                  <td><input name={`basePrice-${rule.id}`} defaultValue={rule.basePrice.toString()} /></td>
                  <td><input name={`pricingVersion-${rule.id}`} defaultValue={rule.pricingVersion ?? "service-pricing-v1"} /><input type="hidden" name={`configurationVersion-${rule.id}`} value={rule.configurationVersion ?? "pricing-config-v1"} /><input type="hidden" name={`notes-${rule.id}`} value={rule.notes ?? ""} /><input type="date" name={`validFrom-${rule.id}`} defaultValue={rule.validFrom?.toISOString().slice(0, 10) ?? ""} /><input type="date" name={`validTo-${rule.id}`} defaultValue={rule.validTo?.toISOString().slice(0, 10) ?? ""} /></td>
                  <td><input name={`isActive-${rule.id}`} type="checkbox" defaultChecked={rule.isActive} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit">Speichern</button>
      </form>
      <PricingSimulationForm services={services} />
    </AdminPortalShell>
  );
}
