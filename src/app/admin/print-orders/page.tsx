import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { Permission, requirePermission } from "@/lib/permissions";
import { listPrintOrders, listPrintPartners, PRINT_STATUS_LABELS, updatePrintOrder } from "@/lib/documents";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

async function updateAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  await requirePermission(Permission.PRINT_PARTNER_VIEW);
  await updatePrintOrder(session, String(formData.get("id")), {
    status: String(formData.get("status") || ""),
    printerId: String(formData.get("printerId") || "") || null,
    trackingNumber: String(formData.get("trackingNumber") || "") || null,
    estimatedNetPrice: String(formData.get("estimatedNetPrice") || "") || null,
    estimatedGrossPrice: String(formData.get("estimatedGrossPrice") || "") || null,
  });
  revalidatePath("/admin/print-orders");
}

export default async function AdminPrintOrdersPage() {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const [printOrders, partners] = await Promise.all([listPrintOrders(session), listPrintPartners()]);
  return (
    <PortalShell eyebrow="Adminbereich" title="Druckaufträge" description="Status, Partner, Tracking und manuelle FLYERO-Druckpreise pflegen." navItems={adminNavItems}>
      <section className="portalMetrics">
        <MetricTile label="Druckaufträge" value={printOrders.length} />
        <MetricTile label="Produktion" value={printOrders.filter((item) => item.status === "IN_PRODUCTION").length} />
        <MetricTile label="Im Lager" value={printOrders.filter((item) => item.status === "RECEIVED_IN_WAREHOUSE").length} tone="success" />
      </section>
      <DataSection title="Aufträge">
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Kunde</th><th>Status</th><th>Spezifikation</th><th>Pflege</th></tr></thead><tbody>
          {printOrders.map((printOrder) => <tr key={printOrder.id}>
            <td>{printOrder.order.orderNumber}</td>
            <td>{printOrder.customer.companyName}</td>
            <td><StatusBadge>{PRINT_STATUS_LABELS[printOrder.status]}</StatusBadge></td>
            <td>{printOrder.printFormat}, {printOrder.paperWeight}g, {printOrder.colorMode}, {printOrder.quantity} Stk.</td>
            <td><form action={updateAction} className="form grid">
              <input type="hidden" name="id" value={printOrder.id} />
              <label>Status<select name="status" defaultValue={printOrder.status}>{Object.entries(PRINT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
              <label>Partner<select name="printerId" defaultValue={printOrder.printerId ?? ""}><option value="">Noch offen</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.companyName}</option>)}</select></label>
              <label>Tracking<input name="trackingNumber" defaultValue={printOrder.trackingNumber ?? ""} /></label>
              <label>Netto EUR<input name="estimatedNetPrice" defaultValue={printOrder.estimatedNetPrice?.toString() ?? ""} /></label>
              <label>Brutto EUR<input name="estimatedGrossPrice" defaultValue={printOrder.estimatedGrossPrice?.toString() ?? ""} /></label>
              <button type="submit">Speichern</button>
            </form></td>
          </tr>)}
          {printOrders.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Druckaufträge." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
