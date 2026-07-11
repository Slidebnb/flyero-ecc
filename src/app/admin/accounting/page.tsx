import { revalidatePath } from "next/cache";
import { AccountingExportFormat, AccountingExportType, UserRole } from "@prisma/client";
import { createAccountingExport, archiveExport } from "@/lib/accountingExport";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";

async function startExport(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  const periodStart = new Date(String(formData.get("periodStart")));
  const periodEnd = new Date(String(formData.get("periodEnd")));
  periodEnd.setHours(23, 59, 59, 999);
  await createAccountingExport({
    type: String(formData.get("type") ?? AccountingExportType.FULL_ACCOUNTING) as AccountingExportType,
    format: String(formData.get("format") ?? AccountingExportFormat.CSV_GENERIC) as AccountingExportFormat,
    periodStart,
    periodEnd,
    createdById: session.id,
  });
  revalidatePath("/admin/accounting");
}

async function archive(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN]);
  await archiveExport({ exportId: String(formData.get("exportId")), userId: session.id });
  revalidatePath("/admin/accounting");
}

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AdminAccountingPage() {
  await requireRole([UserRole.ADMIN]);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const exports = await prisma.accountingExport.findMany({
    include: { items: true, createdBy: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminPortalShell eyebrow="Adminbereich" title="Buchhaltungsexport">

      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Neuer Export</h2>
        <form action={startExport} className="formGrid">
          <label>Zeitraum von<input name="periodStart" type="date" defaultValue={dateInput(start)} required /></label>
          <label>Zeitraum bis<input name="periodEnd" type="date" defaultValue={dateInput(now)} required /></label>
          <label>Exporttyp<select name="type" defaultValue="FULL_ACCOUNTING">
            <option value="INVOICES">Rechnungen</option>
            <option value="PAYMENTS">Zahlungen</option>
            <option value="CREDIT_NOTES">Gutschriften</option>
            <option value="FULL_ACCOUNTING">Vollstaendig</option>
          </select></label>
          <label>Format<select name="format" defaultValue="CSV_LEXWARE">
            <option value="CSV_LEXWARE">Lexware CSV</option>
            <option value="CSV_DATEV">DATEV CSV vorbereitet</option>
            <option value="CSV_GENERIC">Generic CSV</option>
          </select></label>
          <button type="submit">Export starten</button>
        </form>
      </section>

      <section className="panel tableWrap widePanel">
        <table>
          <thead><tr><th>Export</th><th>Typ</th><th>Format</th><th>Status</th><th>Zeitraum</th><th>Zeilen</th><th>Download</th><th>Archiv</th></tr></thead>
          <tbody>
            {exports.map((item) => (
              <tr key={item.id}>
                <td>{item.exportNumber}<br /><small>{formatDateTime(item.createdAt)}</small></td>
                <td>{item.type}</td>
                <td>{item.format}</td>
                <td><span className="badge">{item.status}</span></td>
                <td>{dateInput(item.periodStart)} bis {dateInput(item.periodEnd)}</td>
                <td>{item.rowCount}</td>
                <td>{item.fileUrl ? <a className="textLink" href={`/api/admin/accounting/exports/${item.id}/download`}>CSV</a> : "-"}</td>
                <td>
                  {item.status !== "ARCHIVED" ? (
                    <form action={archive}>
                      <input type="hidden" name="exportId" value={item.id} />
                      <button type="submit">Archivieren</button>
                    </form>
                  ) : "Archiviert"}
                </td>
              </tr>
            ))}
            {exports.length === 0 ? <tr><td colSpan={8}>Noch keine Exporte vorhanden.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </AdminPortalShell>
  );
}
