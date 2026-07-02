import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Prisma, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { getPricingSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

async function savePricing(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  const before = await getPricingSettings();
  for (const key of Object.values(PRICING_SETTING_KEYS)) {
    const value = formData.get(key);
    if (value !== null) {
      await prisma.pricingSetting.upsert({
        where: { key },
        update: { valueDecimal: new Prisma.Decimal(String(value)) },
        create: { key, valueDecimal: new Prisma.Decimal(String(value)), description: `Admin Setting ${key}` },
      });
    }
  }
  const ids = formData.getAll("ruleId").map(String);
  for (const id of ids) {
    await prisma.pricingRule.update({
      where: { id },
      data: {
        minimumNetPrice: new Prisma.Decimal(String(formData.get(`minimumNetPrice-${id}`) ?? "0")),
        pricePerUnit: new Prisma.Decimal(String(formData.get(`pricePerUnit-${id}`) ?? "0")),
        basePrice: new Prisma.Decimal(String(formData.get(`basePrice-${id}`) ?? "0")),
        isActive: formData.get(`isActive-${id}`) === "on",
      },
    });
  }
  const after = await getPricingSettings();
  await createAuditLog({ userId: session.id, action: "settings.pricing_updated", entityType: "Pricing", entityId: "pricing", oldValues: before, newValues: after });
  await notifyAdmins({ type: "PRICING_CHANGED", title: "Preisregel geaendert", message: "Preisregeln wurden aktualisiert." });
  revalidatePath("/admin/settings/pricing");
}

export default async function PricingSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const { settings, rules } = await getPricingSettings();
  const settingValue = (key: string) => settings.find((setting) => setting.key === key)?.valueDecimal.toString() ?? "0";

  return (
    <main className="appShell">
      <header className="topbar"><div><p className="eyebrow">Einstellungen</p><h1>Preise</h1></div><nav className="nav"><Link href="/admin/settings">Zurueck</Link></nav></header>
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
                  <td>{rule.minQuantity}-{rule.maxQuantity ?? "∞"}<input type="hidden" name="ruleId" value={rule.id} /></td>
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
    </main>
  );
}
