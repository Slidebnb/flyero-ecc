import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName } from "@/app/customer/customerUx";
import { requireRole } from "@/lib/auth";
import { formatAddress, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  ISSUED: "Ausgestellt",
  PAID: "Bezahlt",
  CANCELLED: "Storniert",
  OVERDUE: "Überfällig",
};

export default async function CustomerInvoiceDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, customer: { userId: session.id } },
    include: { customer: true, order: true, payment: true, items: true },
  });
  if (!invoice) notFound();
  const invoiceStatus = INVOICE_STATUS_LABELS[invoice.status] ?? "In Prüfung";
  const paidAt = invoice.paidAt ?? invoice.payment?.paidAt ?? null;

  return (
    <CustomerPortalShell active="/customer/invoices" eyebrow="Rechnung" title={invoice.invoiceNumber} description={invoiceStatus}>
      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/invoices">Alle Rechnungen</Link>
        <Link className="secondaryButton" href={`/customer/orders/${invoice.orderId}`}>Kampagne öffnen</Link>
        {invoice.pdfUrl ? <a className="primaryButton" href={`/api/customer/invoices/${invoice.id}/download`}>PDF herunterladen</a> : null}
      </div>

      <section className="gridCards">
        <article className="card"><strong>{formatCurrency(invoice.subtotalNet)}</strong><span>Netto</span></article>
        <article className="card"><strong>{formatCurrency(invoice.vatAmount)}</strong><span>MwSt.</span></article>
        <article className="card"><strong>{formatCurrency(invoice.totalGross)}</strong><span>Brutto</span></article>
        <article className="card"><strong>{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</strong><span>Rechnungsdatum</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Rechnungsdaten</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{invoice.customer.companyName}</td></tr>
              <tr><th>Rechnungsadresse</th><td style={{ whiteSpace: "pre-line" }}>{formatAddress(invoice.customer.billingAddress)}</td></tr>
              <tr><th>Kampagne</th><td>{customerOrderName(invoice.order.orderNumber)}</td></tr>
              <tr><th>Status</th><td>{invoiceStatus}</td></tr>
              <tr><th>Zahlungsreferenz</th><td>{invoice.payment?.stripePaymentIntentId ?? invoice.payment?.stripeCheckoutSessionId ?? "-"}</td></tr>
              <tr><th>Bezahlt am</th><td>{paidAt ? formatDateTime(paidAt) : "-"}</td></tr>
              <tr><th>Hinweis</th><td>{invoice.status === "PAID" ? "Bereits bezahlt" : "Bitte Zahlungsstatus prüfen"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Positionen</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Titel</th><th>Beschreibung</th><th>Menge</th><th>Einzelpreis netto</th><th>Netto</th></tr></thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.description ?? "-"}</td>
                  <td>{item.quantity.toString()} {item.unit}</td>
                  <td>{formatCurrency(item.unitPriceNet)}</td>
                  <td>{formatCurrency(item.lineTotalNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </CustomerPortalShell>
  );
}
