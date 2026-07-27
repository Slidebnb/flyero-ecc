import Link from "next/link";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CustomerLiveRefresh } from "@/app/customer/CustomerLiveRefresh";
import { CUSTOMER_REPORT_STATUS_LABELS, customerAreaName, customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CustomerReportsPage() {
  const session = await requireTenantSession();
  const reports = await prisma.report.findMany({
    where: { tenantId: session.tenantId, status: "PUBLISHED", order: { tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } }, tour: { status: "APPROVED" } },
    include: {
      order: {
        include: {
          distributionSegments: { orderBy: { sortOrder: "asc" }, select: { name: true, city: true, postalCode: true } },
        },
      },
      tour: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const latestReport = reports[0] ?? null;
  const visibleReports = reports.slice(0, 8);
  const evidenceDocuments = await prisma.document.findMany({
    where: {
      tenantId: session.tenantId,
      customerVisible: true,
      status: "APPROVED",
      reviewStatus: "APPROVED",
      documentType: { in: ["REPORT", "IMAGE"] },
      customer: { userId: session.id, tenantId: session.tenantId },
    },
    include: { order: { select: { orderNumber: true, targetAreaName: true, city: true } } },
    orderBy: { uploadedAt: "desc" },
    take: 30,
  });
  const visibleEvidenceDocuments = evidenceDocuments.slice(0, 8);
  const latestEvidence = evidenceDocuments[0] ?? null;

  return (
    <CustomerPortalShell active="/customer/reports" title="Nachweise" description="Freigegebene GPS-Nachweise, Fotos und PDF-Berichte an einem Ort.">
      <CustomerLiveRefresh />
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Geprüfte Ergebnisse</span>
          <h2>{latestReport || latestEvidence ? "Letzten Verteilnachweis ansehen." : "Noch kein Verteilnachweis freigegeben."}</h2>
          <p>Hier sehen Sie die für Sie freigegebenen Nachweise Ihrer Verteilungen.</p>
        </div>
        {latestReport ? (
          <Link className="primaryButton" href={`/customer/reports/${latestReport.id}`}>Nachweis ansehen</Link>
        ) : latestEvidence ? (
          <a className="primaryButton" href={`/api/customer/documents/${latestEvidence.id}/download`}>Nachweis herunterladen</a>
        ) : (
          <Link className="secondaryButton" href="/customer/orders">Kampagnen öffnen</Link>
        )}
      </section>

      <DataSection title="Verteilnachweise" description="Hier finden Sie die von FLYERO freigegebenen GPS-Nachweise, Fotos und PDF-Berichte.">
        <div className="customerCampaignList">
          {visibleEvidenceDocuments.map((document) => (
            <article className="customerCampaignItem" key={`document-${document.id}`}>
              <div>
                <div className="customerItemHeader">
                  <strong>{document.title}</strong>
                  <StatusBadge tone="success">Freigegeben</StatusBadge>
                </div>
                <p>{document.documentType === "REPORT" ? "Der PDF-Nachweis wurde von FLYERO freigegeben." : "Die Foto-Dokumentation wurde von FLYERO freigegeben."}</p>
                <div className="customerItemMeta">
                  <span>{customerOrderName(document.order.orderNumber)}</span>
                  <span>{customerAreaName(document.order.targetAreaName)}</span>
                  <span>{document.order.city}</span>
                </div>
              </div>
              <a className="primaryButton" href={`/api/customer/documents/${document.id}/download`}>Herunterladen</a>
            </article>
          ))}
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
                  {report.order.distributionSegments.length > 1 ? <span>{report.order.distributionSegments.length} Teilgebiete</span> : null}
                  <span>{report.pdfUrl ? "PDF bereit" : "PDF wird erstellt"}</span>
                </div>
              </div>
              <Link className="primaryButton" href={`/customer/reports/${report.id}`}>Nachweis ansehen</Link>
            </article>
          ))}
          {reports.length > visibleReports.length ? (
            <p className="customerListHint">Weitere Nachweise bleiben gespeichert. Die neuesten freigegebenen Berichte stehen oben.</p>
          ) : null}
          {reports.length === 0 && evidenceDocuments.length === 0 ? (
            <EmptyState
              title="Noch keine Nachweise verfügbar."
              description="Nachweise erscheinen hier, sobald FLYERO die Dateiprüfung abgeschlossen hat."
              action={{ href: "/customer/orders", label: "Kampagnen ansehen" }}
            />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
