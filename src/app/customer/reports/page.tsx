import Link from "next/link";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_REPORT_STATUS_LABELS, customerAreaName, customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export default async function CustomerReportsPage() {
  const session = await requireTenantSession();
  const reports = await prisma.report.findMany({
    where: { tenantId: session.tenantId, status: "PUBLISHED", order: { tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } }, tour: { status: "APPROVED" } },
    include: { order: true, tour: true },
    orderBy: { updatedAt: "desc" },
  });
  const latestReport = reports[0] ?? null;
  const visibleReports = reports.slice(0, 8);

  return (
    <CustomerPortalShell active="/customer/reports" title="Nachweise" description="Freigegebene GPS-Nachweise, Fotos und PDF-Berichte an einem Ort.">
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Geprüfte Ergebnisse</span>
          <h2>{latestReport ? "Letzten Verteilnachweis ansehen." : "Noch kein Verteilnachweis freigegeben."}</h2>
          <p>Nachweise erscheinen erst nach interner Prüfung durch FLYERO.</p>
        </div>
        {latestReport ? (
          <Link className="primaryButton" href={`/customer/reports/${latestReport.id}`}>Nachweis ansehen</Link>
        ) : (
          <Link className="secondaryButton" href="/customer/orders">Kampagnen öffnen</Link>
        )}
      </section>

      <DataSection title="Verteilnachweise" description="Nur geprüfte und veröffentlichte Nachweise werden hier angezeigt.">
        <div className="customerCampaignList">
          {visibleReports.map((report) => (
            <article className="customerCampaignItem" key={report.id}>
              <div>
                <div className="customerItemHeader">
                  <strong>{customerReportName(report.reportNumber)}</strong>
                  <StatusBadge tone="success">{CUSTOMER_REPORT_STATUS_LABELS[report.status]}</StatusBadge>
                </div>
                <p>Von FLYERO geprüft. GPS-Nachweis, Fotos und PDF stehen nach Freigabe hier bereit.</p>
                <div className="customerItemMeta">
                  <span>{customerOrderName(report.order.orderNumber)}</span>
                  <span>{customerAreaName(report.order.targetAreaName)}</span>
                  <span>{report.pdfUrl ? "PDF bereit" : "PDF wird erstellt"}</span>
                </div>
              </div>
              <Link className="primaryButton" href={`/customer/reports/${report.id}`}>Nachweis ansehen</Link>
            </article>
          ))}
          {reports.length > visibleReports.length ? (
            <p className="customerListHint">Weitere Nachweise bleiben gespeichert. Die neuesten freigegebenen Berichte stehen oben.</p>
          ) : null}
          {reports.length === 0 ? (
            <EmptyState
              title="Noch keine Nachweise verfügbar."
              description="Nachweise erscheinen hier, sobald FLYERO die Verteilung geprüft und veröffentlicht hat."
              action={{ href: "/customer/orders", label: "Kampagnen ansehen" }}
            />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
