import Link from "next/link";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getNumberingSettings, updateNumberingSettings } from "@/lib/settings";

async function saveNumbering(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  await updateNumberingSettings({
    invoicePrefix: String(formData.get("invoicePrefix") ?? ""),
    invoiceYear: Number(formData.get("invoiceYear")),
    invoiceNextNumber: Number(formData.get("invoiceNextNumber")),
    reportPrefix: String(formData.get("reportPrefix") ?? ""),
    reportYear: Number(formData.get("reportYear")),
    reportNextNumber: Number(formData.get("reportNextNumber")),
    orderPrefix: String(formData.get("orderPrefix") ?? ""),
    orderYear: Number(formData.get("orderYear")),
    orderNextNumber: Number(formData.get("orderNextNumber")),
  }, session.id);
  revalidatePath("/admin/settings/numbering");
}

export default async function NumberingSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const settings = await getNumberingSettings();
  return (
    <main className="appShell">
      <header className="topbar"><div><p className="eyebrow">Einstellungen</p><h1>Nummernkreise</h1></div><nav className="nav"><Link href="/admin/settings">Zurueck</Link></nav></header>
      <form action={saveNumbering} className="panel stack widePanel">
        <div className="formGrid">
          {(["invoice", "report", "order"] as const).map((kind) => (
            <fieldset key={kind} className="panel">
              <legend>{kind === "invoice" ? "Rechnung" : kind === "report" ? "Bericht" : "Auftrag"}</legend>
              <label>Prefix<input name={`${kind}Prefix`} defaultValue={settings[`${kind}Prefix`]} /></label>
              <label>Jahr<input name={`${kind}Year`} type="number" defaultValue={settings[`${kind}Year`]} /></label>
              <label>Naechste Nummer<input name={`${kind}NextNumber`} type="number" min="1" defaultValue={settings[`${kind}NextNumber`]} /></label>
            </fieldset>
          ))}
        </div>
        <button type="submit">Vorsichtig speichern</button>
      </form>
    </main>
  );
}
