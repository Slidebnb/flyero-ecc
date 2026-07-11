import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getBrandingSettings, updateBrandingSettings } from "@/lib/settings";

async function saveBranding(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  await updateBrandingSettings(Object.fromEntries(formData.entries()), session.id);
  revalidatePath("/admin/settings/branding");
}

export default async function BrandingSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const settings = await getBrandingSettings();
  return (
    <AdminPortalShell eyebrow="Einstellungen" title="Branding">
      <form action={saveBranding} className="panel stack widePanel">
        <div className="formGrid">
          <label>Logo URL<input name="logoUrl" defaultValue={settings.logoUrl ?? ""} /></label>
          <label>Hauptfarbe<input name="primaryColor" type="color" defaultValue={settings.primaryColor} /></label>
          <label>Sekundaerfarbe<input name="secondaryColor" type="color" defaultValue={settings.secondaryColor} /></label>
          <label>Akzentfarbe<input name="accentColor" type="color" defaultValue={settings.accentColor} /></label>
          <label>Report-Footer<textarea name="reportFooterText" defaultValue={settings.reportFooterText ?? ""} /></label>
          <label>Invoice-Footer<textarea name="invoiceFooterText" defaultValue={settings.invoiceFooterText ?? ""} /></label>
        </div>
        <button type="submit">Speichern</button>
      </form>
    </AdminPortalShell>
  );
}

