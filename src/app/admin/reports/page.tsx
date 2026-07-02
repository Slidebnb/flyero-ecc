import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminReportsPage() {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const reports = await prisma.report.findMany({
    include: { order: { include: { customer: true } }, tour: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AdminPortalShell
      title="Berichte"
      description="Verteilberichte prüfen, veröffentlichen und PDF-Status kontrollieren."
    >
      <DataSection title="Berichtsliste">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Bericht</th><th>Auftrag</th><th>Kunde</th><th>Status</th><th>PDF</th><th>Aktualisiert</th><th>Aktion</th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reportNumber}</td>
                  <td>{report.order.orderNumber}</td>
                  <td>{report.order.customer.companyName}</td>
                  <td><StatusBadge>{report.status}</StatusBadge></td>
                  <td>{report.pdfUrl ? "Ja" : "Nein"}</td>
                  <td>{formatDateTime(report.updatedAt)}</td>
                  <td><Link className="textLink" href={`/admin/reports/${report.id}`}>Öffnen</Link></td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="Noch keine Berichte." description="Berichte entstehen nach geprüften Touren." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
