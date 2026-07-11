import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getCompanySettings, updateCompanySettings } from "@/lib/settings";

async function saveCompany(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  await updateCompanySettings(Object.fromEntries(formData.entries()), session.id);
  revalidatePath("/admin/settings/company");
}

export default async function CompanySettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const settings = await getCompanySettings();
  const fields = [
    ["companyName", "Firmenname"],
    ["legalName", "Rechtlicher Name"],
    ["street", "Adresse"],
    ["postalCode", "PLZ"],
    ["city", "Stadt"],
    ["country", "Land"],
    ["phone", "Telefon"],
    ["email", "E-Mail"],
    ["website", "Website"],
    ["taxNumber", "Steuernummer"],
    ["vatId", "USt-ID"],
    ["bankName", "Bank"],
    ["iban", "IBAN"],
    ["bic", "BIC"],
    ["logoUrl", "Logo URL"],
  ] as const;

  return (
    <AdminPortalShell eyebrow="Einstellungen" title="Firma">
      <form action={saveCompany} className="panel stack widePanel">
        <div className="formGrid">
          {fields.map(([name, label]) => (
            <label key={name}>{label}<input name={name} defaultValue={String(settings[name] ?? "")} /></label>
          ))}
        </div>
        <button type="submit">Speichern</button>
      </form>
    </AdminPortalShell>
  );
}

