import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName } from "@/app/customer/customerUx";
import { DataSection, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
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

function statusTone(status: string) {
  if (status === "PAID") return "success" as const;
  if (status === "OVERDUE") return "danger" as const;
  if (status === "ISSUED" || status === "DRAFT") return "warning" as const;
  return "neutral" as const;
}

export default async function CustomerInvoiceDetailPage({ params }: PageProps) {
  const session = await requireTenantSession();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
    include: { customer: true, order: true, payment: true, items: true },
  });
  if (!invoice) notFound();

  const invoiceStatus = INVOICE_STATUS_LABELS[invoice.status] ?? "In Prüfung";
  const paidAt = invoice.paidAt ?? invoice.payment?.paidAt ?? null;
  const totalQuantity = invoice.items.reduce((sum, item) => sum + Number(item.quantity), 0);

  return (
    <CustomerPortalShell active="/customer/invoices" eyebrow="Rechnung" title={invoice.invoiceNumber} description={invoiceStatus}>
      <section className={invoice.status === "PAID" ? "customerSuccessBanner" : "customerWarningBanner"}>
        <strong>{invoice.status === "PAID" ? "Rechnung bezahlt." : "Rechnung im Blick behalten."}</strong>
        <span>{invoice.status === "PAID" ? "PDF und Kampagne bleiben hier jederzeit erreichbar." : "Wenn eine Zahlung offen ist, finden Sie den nächsten Schritt in der passenden Kampagne."}</span>
        {invoice.pdfUrl ? <a className="primaryButton" href={`/api/customer/invoices/${invoice.id}/download`}>PDF herunterladen</a> : null}
      </section>

      <section className="customerDetailActions" aria-label="Rechnungsaktionen">
        <Link className="secondaryButton" href="/customer/invoices">Alle Rechnungen</Link>
        <Link className="secondaryButton" href={`/customer/orders/${invoice.orderId}`}>Kampagne öffnen</Link>
      </section>

      <section className="customerDigestGrid">
        <article><span>Gesamtbetrag</span><strong>{formatCurrency(invoice.totalGross)}</strong></article>
        <article><span>Status</span><strong><StatusBadge tone={statusTone(invoice.status)}>{invoiceStatus}</StatusBadge></strong></article>
        <article><span>Rechnungsdatum</span><strong>{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</strong></article>
        <article><span>Bezahlt am</span><strong>{paidAt ? formatDateTime(paidAt) : "Noch offen"}</strong></article>
      </section>

      <div className="customerTwoColumn">
        <DataSection title="Rechnungsdaten" description="Alles Wesentliche ohne technische Details.">
          <div className="customerFactList">
            <p><span>Kunde</span><strong>{invoice.customer.companyName}</strong></p>
            <p><span>Kampagne</span><strong>{customerOrderName(invoice.order.orderNumber)}</strong></p>
            <p><span>Adresse</span><strong style={{ whiteSpace: "pre-line" }}>{formatAddress(invoice.customer.billingAddress)}</strong></p>
            <p><span>Hinweis</span><strong>{invoice.status === "PAID" ? "Bereits bezahlt" : "Bitte Kampagne öffnen, falls Zahlung offen ist."}</strong></p>
          </div>
        </DataSection>

        <DataSection title="Kurzüberblick" description="Für schnelle Prüfung und Buchhaltung.">
          <div className="customerFactList">
            <p><span>Positionen</span><strong>{invoice.items.length}</strong></p>
            <p><span>Menge gesamt</span><strong>{totalQuantity.toLocaleString("de-DE")}</strong></p>
            <p><span>Netto</span><strong>{formatCurrency(invoice.subtotalNet)}</strong></p>
            <p><span>Brutto</span><strong>{formatCurrency(invoice.totalGross)}</strong></p>
          </div>
        </DataSection>
      </div>

      <DataSection title="Positionen" description="Die Rechnungspositionen kompakt zusammengefasst.">
        <div className="customerMessageList">
          {invoice.items.map((item) => (
            <article className="customerMessageItem" key={item.id}>
              <div className="customerItemHeader">
                <strong>{item.title}</strong>
                <span>{formatCurrency(item.lineTotalNet)}</span>
              </div>
              <div className="customerItemMeta">
                <span>{item.description ?? "Keine Zusatzbeschreibung"}</span>
                <span>{item.quantity.toString()} {item.unit}</span>
                <span>{formatCurrency(item.unitPriceNet)} netto</span>
              </div>
            </article>
          ))}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
