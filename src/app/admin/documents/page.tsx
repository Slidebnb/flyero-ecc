import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { addDocumentComment, approveDocument, DOCUMENT_STATUS_LABELS, DOCUMENT_TYPE_LABELS, getDocumentAnalytics, listDocuments, rejectDocument, rescanDocument } from "@/lib/documents";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

async function approveAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  await approveDocument(session, String(formData.get("documentId")), String(formData.get("message") || ""));
  revalidatePath("/admin/documents");
}

async function rejectAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  await rejectDocument(session, String(formData.get("documentId")), String(formData.get("rejectedReason") || "Bitte Datei prüfen und neu hochladen."));
  revalidatePath("/admin/documents");
}

async function commentAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  await addDocumentComment(session, String(formData.get("documentId")), {
    message: String(formData.get("message") || ""),
    visibility: String(formData.get("visibility") || "INTERNAL"),
  });
  revalidatePath("/admin/documents");
}

async function scanAction(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.DOCUMENT_SCAN);
  await rescanDocument(session, String(formData.get("documentId")));
  revalidatePath("/admin/documents");
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatDate(date: Date | null) {
  return date ? new Intl.DateTimeFormat("de-DE").format(date) : "-";
}

export default async function AdminDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const params = await searchParams;
  const [documents, analytics, customers, orders] = await Promise.all([
    listDocuments(session, params),
    getDocumentAnalytics(),
    prisma.customerProfile.findMany({ select: { id: true, companyName: true }, orderBy: { companyName: "asc" }, take: 200 }),
    prisma.order.findMany({ select: { id: true, orderNumber: true, targetAreaName: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  return (
    <PortalShell eyebrow="Adminbereich" title="Dokumentenzentrale" description="Druckdateien, Freigaben, Versionen und Dokumentrechte zentral prüfen." navItems={adminNavItems}>
      <section className="portalMetrics">
        <MetricTile label="Dokumente" value={analytics.documents} />
        <MetricTile label="Versionen" value={analytics.versions} />
        <MetricTile label="In Prüfung" value={documents.filter((item) => item.status === "UNDER_REVIEW").length} tone="warning" />
        <MetricTile label="Ø Freigabe" value={`${analytics.averageApprovalHours} h`} />
        <MetricTile label="Ø Druckzeit" value={`${analytics.averagePrintProcessDays} Tage`} />
      </section>

      <DataSection title="Filter">
        <form className="form grid">
          <label>Suche<input name="q" defaultValue={params.q ?? ""} /></label>
          <label>Kunde<select name="customerId" defaultValue={params.customerId ?? ""}><option value="">Alle Kunden</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}</select></label>
          <label>Auftrag<select name="orderId" defaultValue={params.orderId ?? ""}><option value="">Alle Aufträge</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} - {order.targetAreaName}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Alle</option>{Object.entries(DOCUMENT_STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select></label>
          <label>Typ<select name="documentType" defaultValue={params.documentType ?? ""}><option value="">Alle</option>{Object.entries(DOCUMENT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <label>Freigabe<select name="approval" defaultValue={params.approval ?? ""}><option value="">Alle</option><option value="open">Offen</option><option value="approved">Freigegeben</option></select></label>
          <label>Von<input name="uploadedFrom" type="date" defaultValue={params.uploadedFrom ?? ""} /></label>
          <label>Bis<input name="uploadedTo" type="date" defaultValue={params.uploadedTo ?? ""} /></label>
          <label>Min. Größe Bytes<input name="minSize" type="number" min="0" defaultValue={params.minSize ?? ""} /></label>
          <label>Max. Größe Bytes<input name="maxSize" type="number" min="0" defaultValue={params.maxSize ?? ""} /></label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <DataSection title="Dokumente">
        <div className="tableWrap"><table><thead><tr><th>Dokument</th><th>Kunde</th><th>Auftrag</th><th>Typ</th><th>Status</th><th>Dateiprüfung</th><th>Größe</th><th>Datum</th><th>Freigabe</th><th>Aktion</th></tr></thead><tbody>
          {documents.map((document) => <tr key={document.id}>
            <td>{document.title}<br /><small>{document.originalFilename} / v{document.version} / {document.versions.length} Versionen</small></td>
            <td>{document.customer.companyName}</td>
            <td>{document.order.orderNumber}</td>
            <td>{DOCUMENT_TYPE_LABELS[document.documentType]}</td>
            <td><StatusBadge>{DOCUMENT_STATUS_LABELS[document.status]}</StatusBadge></td>
            <td><StatusBadge>{document.scanStatus}</StatusBadge><form action={scanAction} style={{ marginTop: 8 }}><input type="hidden" name="documentId" value={document.id} /><button type="submit">Erneut prüfen</button></form></td>
            <td>{formatFileSize(document.fileSize)}</td>
            <td>{formatDate(document.uploadedAt)}</td>
            <td>{document.approvedAt ? formatDate(document.approvedAt) : "Offen"}</td>
            <td>
              <form action={approveAction} style={{ display: "inline-flex", gap: 8 }}>
                <input type="hidden" name="documentId" value={document.id} />
                <input type="hidden" name="message" value="Dokument wurde freigegeben." />
                <button type="submit">Freigeben</button>
              </form>
              <form action={rejectAction} style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
                <input type="hidden" name="documentId" value={document.id} />
                <input name="rejectedReason" placeholder="Grund" />
                <button type="submit">Ablehnen</button>
              </form>
              <form action={commentAction} style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <input type="hidden" name="documentId" value={document.id} />
                <select name="visibility" defaultValue="INTERNAL"><option value="INTERNAL">Intern</option><option value="PUBLIC">Kunde sichtbar</option></select>
                <input name="message" placeholder="Kommentar schreiben" />
                <button type="submit">Kommentieren</button>
              </form>
            </td>
          </tr>)}
          {documents.length === 0 ? <tr><td colSpan={10}><EmptyState title="Keine Dokumente im Filter." /></td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
