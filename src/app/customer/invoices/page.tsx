import Link from "next/link";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  ISSUED: "Ausgestellt",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
  OVERDUE: "Überfällig",
};

export default async function CustomerInvoicesPage() {
  const session = await requireTenantSession();
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
    include: { order: true, payment: true },
    orderBy: { invoiceDate: "desc" },
  });
  const uploadedInvoiceDocuments = await prisma.document.findMany({
    where: {
      tenantId: session.tenantId,
      customerVisible: true,
      status: "APPROVED",
      reviewStatus: "APPROVED",
      documentType: "INVOICE",
      customer: { userId: session.id, tenantId: session.tenantId },
    },
    include: { order: { select: { id: true, orderNumber: true, targetAreaName: true, city: true } } },
    orderBy: { uploadedAt: "desc" },
    take: 20,
  });
  const latestInvoice = invoices[0] ?? null;
  const latestUploadedInvoice = uploadedInvoiceDocuments[0] ?? null;
  const visibleInvoices = invoices.slice(0, 10);

  return (
    <CustomerPortalShell active="/customer/invoices" title="Rechnungen" description="Rechnung finden, PDF laden oder direkt zur Kampagne wechseln.">
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Abrechnung</span>
          <h2>{latestInvoice || latestUploadedInvoice ? "Letzte Rechnung direkt öffnen." : "Noch keine Rechnung vorhanden."}</h2>
          <p>
            {latestInvoice
              ? `${latestInvoice.invoiceNumber} · ${formatCurrency(latestInvoice.totalGross)}`
              : latestUploadedInvoice
                ? `${latestUploadedInvoice.title} · ${customerOrderName(latestUploadedInvoice.order?.orderNumber || "Kampagne")}`
                : "Sobald eine Kampagne abgerechnet wird, erscheint die Rechnung hier."}
          </p>
        </div>
        {latestInvoice?.pdfUrl ? (
          <a className="primaryButton" href={`/api/customer/invoices/${latestInvoice.id}/download`}>PDF herunterladen</a>
        ) : latestUploadedInvoice ? (
          <a className="primaryButton" href={`/api/customer/documents/${latestUploadedInvoice.id}/download`}>PDF herunterladen</a>
        ) : (
          <Link className="secondaryButton" href="/customer/orders">Kampagnen öffnen</Link>
        )}
      </section>

      <DataSection title="Alle Rechnungen" description="Die neuesten Rechnungen zuerst. PDF laden oder die passende Kampagne öffnen.">
        <div className="customerCampaignList">
          {visibleInvoices.map((invoice) => (
            <article className="customerCampaignItem" key={invoice.id}>
              <div>
                <div className="customerItemHeader">
                  <strong>{invoice.invoiceNumber}</strong>
                  <StatusBadge tone={invoice.status === "PAID" ? "success" : "warning"}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</StatusBadge>
                </div>
                <p>{customerOrderName(invoice.order.orderNumber)}</p>
                <div className="customerItemMeta">
                  <span>{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</span>
                  <span>{formatCurrency(invoice.totalGross)}</span>
                  <span>{invoice.pdfUrl ? "PDF bereit" : "PDF wird erstellt"}</span>
                </div>
              </div>
              {invoice.pdfUrl ? (
                <a className="primaryButton" href={`/api/customer/invoices/${invoice.id}/download`}>PDF laden</a>
              ) : (
                <Link className="secondaryButton" href={`/customer/invoices/${invoice.id}`}>Ansehen</Link>
              )}
            </article>
          ))}
          {invoices.length > visibleInvoices.length ? (
            <p className="customerListHint">Weitere Rechnungen bleiben gespeichert. Die aktuell wichtigsten Einträge stehen oben.</p>
          ) : null}
          {invoices.length === 0 && uploadedInvoiceDocuments.length === 0 ? (
            <EmptyState
              title="Noch keine Rechnungen vorhanden."
              description="Rechnungen werden nach erfolgreicher Zahlung oder manueller Bereitstellung hier angezeigt."
              action={{ href: "/customer/orders", label: "Kampagnen prüfen" }}
            />
          ) : null}
        </div>
      </DataSection>

      {uploadedInvoiceDocuments.length > 0 ? (
        <DataSection title="Bereitgestellte Rechnungen" description="Von FLYERO freigegebene Rechnungs-PDFs für dein Kundenkonto.">
          <div className="customerCampaignList">
            {uploadedInvoiceDocuments.map((document) => (
              <article className="customerCampaignItem" key={document.id}>
                <div>
                  <div className="customerItemHeader">
                    <strong>{document.title}</strong>
                    <StatusBadge tone="success">PDF bereit</StatusBadge>
                  </div>
                  <p>{customerOrderName(document.order?.orderNumber || "Kampagne")}</p>
                  <div className="customerItemMeta">
                    <span>{formatDate(document.uploadedAt)}</span>
                    <span>{document.order?.targetAreaName || document.order?.city || "Kampagne"}</span>
                  </div>
                </div>
                <a className="primaryButton" href={`/api/customer/documents/${document.id}/download`}>PDF laden</a>
              </article>
            ))}
          </div>
        </DataSection>
      ) : null}
    </CustomerPortalShell>
  );
}
