import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
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
  const session = await requireRole([UserRole.CUSTOMER]);
  const invoices = await prisma.invoice.findMany({
    where: { customer: { userId: session.id } },
    include: { order: true, payment: true },
    orderBy: { invoiceDate: "desc" },
  });
  const latestInvoice = invoices[0] ?? null;

  return (
    <CustomerPortalShell active="/customer/invoices" title="Rechnungen" description="Rechnungen finden, PDF laden und die passende Kampagne öffnen.">
      <section className="portalMetrics">
        <MetricTile label="Rechnungen" value={invoices.length} />
        <MetricTile label="Bezahlt" value={invoices.filter((invoice) => invoice.status === "PAID").length} tone="success" />
        <MetricTile label="Offen" value={invoices.filter((invoice) => invoice.status !== "PAID").length} tone="warning" />
        <MetricTile label="PDFs" value={invoices.filter((invoice) => invoice.pdfUrl).length} />
      </section>

      <DataSection title="Alle Rechnungen" description="Die wichtigsten Aktionen sind PDF laden oder Kampagne öffnen.">
        <div className="customerActionRow">
          {latestInvoice?.pdfUrl ? <a className="secondaryButton" href={`/api/customer/invoices/${latestInvoice.id}/download`}>Letzte Rechnung laden</a> : null}
          <Link className="secondaryButton" href="/customer/orders">Kampagnen öffnen</Link>
          <Link className="secondaryButton" href="/customer/payments">Zahlungen ansehen</Link>
        </div>
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Rechnung</th><th>Kampagne</th><th>Status</th><th>Datum</th><th>Betrag</th><th>Aktion</th></tr></thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td data-label="Rechnung"><strong>{invoice.invoiceNumber}</strong></td>
                  <td data-label="Kampagne">{customerOrderName(invoice.order.orderNumber)}</td>
                  <td data-label="Status"><StatusBadge tone={invoice.status === "PAID" ? "success" : "warning"}>{INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}</StatusBadge></td>
                  <td data-label="Datum">{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</td>
                  <td data-label="Betrag">{formatCurrency(invoice.totalGross)}</td>
                  <td data-label="Aktion">{invoice.pdfUrl ? <a className="textLink" href={`/api/customer/invoices/${invoice.id}/download`}>PDF laden</a> : <Link className="textLink" href={`/customer/invoices/${invoice.id}`}>Ansehen</Link>}</td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Noch keine Rechnungen vorhanden."
                      description="Rechnungen werden nach erfolgreicher Zahlung und Freigabe automatisch erzeugt."
                      action={{ href: "/customer/orders", label: "Kampagnen prüfen" }}
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
