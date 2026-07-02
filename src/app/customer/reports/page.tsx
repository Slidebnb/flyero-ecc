import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerReportsPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const reports = await prisma.report.findMany({
    where: { status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] }, order: { customer: { userId: session.id } }, tour: { status: "APPROVED" } },
    include: { order: true, tour: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <CustomerPortalShell active="/customer/reports" title="Berichte" description="Verteilnachweise, PDFs und geprüfte Ergebnisse Ihrer Kampagnen.">
      <section className="portalMetrics">
        <MetricTile label="Berichte" value={reports.length} />
        <MetricTile label="Veröffentlicht" value={reports.filter((report) => report.status === "PUBLISHED").length} tone="success" />
        <MetricTile label="PDFs" value={reports.filter((report) => report.pdfUrl).length} />
        <MetricTile label="Letztes Update" value={reports[0] ? formatDateTime(reports[0].updatedAt).slice(0, 10) : "-"} />
      </section>

      <DataSection title="Verteilberichte">
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Bericht</th><th>Auftrag</th><th>Status</th><th>Gebiet</th><th>PDF</th><th>Aktion</th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td data-label="Bericht"><strong>{report.reportNumber}</strong></td>
                  <td data-label="Auftrag">{report.order.orderNumber}</td>
                  <td data-label="Status"><StatusBadge tone="success">{report.status}</StatusBadge></td>
                  <td data-label="Gebiet">{report.order.targetAreaName}</td>
                  <td data-label="PDF">{report.pdfUrl ? <a className="textLink" href={`/api/customer/reports/${report.id}/download`}>Download</a> : "-"}</td>
                  <td data-label="Aktion"><Link className="textLink" href={`/customer/reports/${report.id}`}>Ansehen</Link></td>
                </tr>
              ))}
              {reports.length === 0 ? <tr><td colSpan={6}><EmptyState title="Noch keine Verteilberichte verfügbar." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
