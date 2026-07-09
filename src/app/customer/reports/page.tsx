import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_REPORT_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
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
    <CustomerPortalShell active="/customer/reports" title="Berichte" description="Hier sehen Sie, wann, wo und mit welchen Nachweisen verteilt wurde.">
      <section className="portalMetrics">
        <MetricTile label="Nachweise" value={reports.length} />
        <MetricTile label="Freigegeben" value={reports.filter((report) => report.status === "PUBLISHED" || report.status === "APPROVED").length} tone="success" />
        <MetricTile label="PDF-Berichte" value={reports.filter((report) => report.pdfUrl).length} />
        <MetricTile label="Letztes Update" value={reports[0] ? formatDateTime(reports[0].updatedAt).slice(0, 10) : "-"} />
      </section>

      <DataSection title="Nachweis der Verteilung" description="GPS-Spur, Foto-Nachweise, interne Prüfung und PDF-Bericht gehören hier zusammen.">
        <div className="customerActionRow">
          <Link className="secondaryButton" href="/customer/orders">Kampagnen ansehen</Link>
          <Link className="secondaryButton" href="/customer/invoices">Rechnungen öffnen</Link>
        </div>
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Bericht</th><th>Kampagne</th><th>Status</th><th>Gebiet</th><th>PDF</th><th>Aktion</th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td data-label="Bericht"><strong>{report.reportNumber}</strong><br /><small>GPS + Fotos geprüft</small></td>
                  <td data-label="Kampagne">{customerOrderName(report.order.orderNumber)}</td>
                  <td data-label="Status"><StatusBadge tone="success">{CUSTOMER_REPORT_STATUS_LABELS[report.status]}</StatusBadge></td>
                  <td data-label="Gebiet">{report.order.targetAreaName}</td>
                  <td data-label="PDF">{report.pdfUrl ? <a className="textLink" href={`/api/customer/reports/${report.id}/download`}>Download</a> : "Wird erstellt"}</td>
                  <td data-label="Aktion"><Link className="textLink" href={`/customer/reports/${report.id}`}>Nachweis ansehen</Link></td>
                </tr>
              ))}
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Noch keine Verteilberichte verfügbar."
                      description="Berichte erscheinen automatisch, sobald eine Tour geprüft und freigegeben wurde."
                      action={{ href: "/customer/orders", label: "Kampagnen ansehen" }}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
