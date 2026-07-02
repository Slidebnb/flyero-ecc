import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createPrintPartner, listPrintPartners, updatePrintPartner } from "@/lib/documents";

async function createAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
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
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  await updatePrintPartner(session, String(formData.get("id")), { isActive: String(formData.get("isActive")) === "true" });
  revalidatePath("/admin/print-partners");
}

export default async function AdminPrintPartnersPage() {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const partners = await listPrintPartners();
  return (
    <PortalShell eyebrow="Adminbereich" title="Druckpartner" description="Partnerkontakte, Status und Konditionen sauber pflegen." navItems={[{ href: "/admin/documents", label: "Dokumente" }, { href: "/admin/print-orders", label: "Druckaufträge" }, { href: "/admin/dashboard", label: "Dashboard" }]}>
      <ActionPanel title="Druckpartner anlegen">
        <form action={createAction} className="form grid">
          <label>Firma<input name="companyName" required /></label>
          <label>Kontakt<input name="contactName" /></label>
          <label>E-Mail<input name="email" type="email" required /></label>
          <label>Telefon<input name="phone" /></label>
          <label className="full">Adresse<input name="address" /></label>
          <button type="submit">Partner speichern</button>
        </form>
      </ActionPanel>
      <DataSection title="Partner">
        <div className="tableWrap"><table><thead><tr><th>Firma</th><th>Kontakt</th><th>E-Mail</th><th>Status</th><th>Aktion</th></tr></thead><tbody>
          {partners.map((partner) => <tr key={partner.id}><td>{partner.companyName}</td><td>{partner.contactName ?? "-"}</td><td>{partner.email}</td><td><StatusBadge tone={partner.isActive ? "success" : "neutral"}>{partner.isActive ? "Aktiv" : "Inaktiv"}</StatusBadge></td><td><form action={toggleAction}><input type="hidden" name="id" value={partner.id} /><input type="hidden" name="isActive" value={partner.isActive ? "false" : "true"} /><button type="submit">{partner.isActive ? "Deaktivieren" : "Aktivieren"}</button></form></td></tr>)}
          {partners.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Druckpartner." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
