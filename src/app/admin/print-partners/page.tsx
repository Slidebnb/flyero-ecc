import { revalidatePath } from "next/cache";
import { ActionPanel, DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { hasPermission, Permission, requirePermission } from "@/lib/permissions";
import { createPrintPartner, listPrintPartners, updatePrintPartner } from "@/lib/documents";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

async function createAction(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.PRINT_PARTNER_MANAGE);
  await createPrintPartner(session, {
    companyName: String(formData.get("companyName") || ""),
    contactName: String(formData.get("contactName") || ""),
    email: String(formData.get("email") || ""),
    phone: String(formData.get("phone") || ""),
    address: String(formData.get("address") || ""),
    isActive: true,
  });
  revalidatePath("/admin/print-partners");
}

async function toggleAction(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.PRINT_PARTNER_MANAGE);
  await updatePrintPartner(session, String(formData.get("id")), { isActive: String(formData.get("isActive")) === "true" });
  revalidatePath("/admin/print-partners");
}

export default async function AdminPrintPartnersPage() {
  const session = await requirePermission(Permission.PRINT_PARTNER_VIEW);
  const canManage = hasPermission(session, Permission.PRINT_PARTNER_MANAGE);
  const partners = await listPrintPartners();
  return (
    <PortalShell eyebrow="Adminbereich" title="Druckpartner" description="Partnerkontakte, Status und Konditionen sauber pflegen." navItems={adminNavItems}>
      {canManage ? <ActionPanel title="Druckpartner anlegen">
        <form action={createAction} className="form grid">
          <label>Firma<input name="companyName" required /></label>
          <label>Kontakt<input name="contactName" /></label>
          <label>E-Mail<input name="email" type="email" required /></label>
          <label>Telefon<input name="phone" /></label>
          <label className="full">Adresse<input name="address" /></label>
          <button type="submit">Partner speichern</button>
        </form>
      </ActionPanel> : null}
      <DataSection title="Partner">
        <div className="tableWrap"><table><thead><tr><th>Firma</th><th>Kontakt</th><th>E-Mail</th><th>Status</th><th>Aktion</th></tr></thead><tbody>
          {partners.map((partner) => <tr key={partner.id}><td>{partner.companyName}</td><td>{partner.contactName ?? "-"}</td><td>{partner.email}</td><td><StatusBadge tone={partner.isActive ? "success" : "neutral"}>{partner.isActive ? "Aktiv" : "Inaktiv"}</StatusBadge></td><td>{canManage ? <form action={toggleAction}><input type="hidden" name="id" value={partner.id} /><input type="hidden" name="isActive" value={partner.isActive ? "false" : "true"} /><button type="submit">{partner.isActive ? "Deaktivieren" : "Aktivieren"}</button></form> : "Nur Lesen"}</td></tr>)}
          {partners.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Druckpartner." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
