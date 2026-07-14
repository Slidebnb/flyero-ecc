import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
﻿import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatAddress, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productionInvoiceWhere } from "@/lib/productionData";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminInvoiceDetailPage({ params }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...productionInvoiceWhere() },
    include: { customer: true, order: true, payment: true, items: true, creditNotes: true },
  });
  if (!invoice) notFound();
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: { in: ["Invoice", "CreditNote"] }, OR: [{ entityId: invoice.id }, { newValues: { path: ["invoiceId"], equals: invoice.id } }] },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <AdminPortalShell eyebrow="Adminbereich" title={invoice.invoiceNumber}>
      <div className="portalActions"><Link href="/admin/invoices">Alle Rechnungen</Link></div>

      <section className="gridCards">
        <article className="card"><strong>{formatCurrency(invoice.subtotalNet)}</strong><span>Netto</span></article>
        <article className="card"><strong>{formatCurrency(invoice.vatAmount)}</strong><span>MwSt.</span></article>
        <article className="card"><strong>{formatCurrency(invoice.totalGross)}</strong><span>Brutto</span></article>
        <article className="card"><strong>{invoice.creditNotes.length}</strong><span>Gutschriften</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Aktionen</h2>
        <div className="actions">
          <form action={`/api/admin/invoices/${invoice.id}/regenerate-pdf`} method="post">
            <button type="submit">PDF neu erzeugen</button>
          </form>
          <form action={`/api/admin/invoices/${invoice.id}/cancel`} method="post">
            <input type="hidden" name="prepareCreditNote" value="true" />
            <input name="reason" placeholder="Grund für Storno/Gutschrift" />
            <button type="submit">Storno und Gutschrift vorbereiten</button>
          </form>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Details</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{invoice.customer.companyName}</td></tr>
              <tr><th>Adresse</th><td style={{ whiteSpace: "pre-line" }}>{formatAddress(invoice.customer.billingAddress)}</td></tr>
              <tr><th>Auftrag</th><td>{invoice.order.orderNumber}</td></tr>
              <tr><th>Zahlung</th><td>{invoice.payment?.stripePaymentIntentId ?? invoice.payment?.stripeCheckoutSessionId ?? "-"}</td></tr>
              <tr><th>Rechnungsdatum</th><td>{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</td></tr>
              <tr><th>Leistungsdatum</th><td>{formatDate(invoice.serviceDate ?? invoice.createdAt)}</td></tr>
              <tr><th>Bezahlt</th><td>{formatDateTime(invoice.paidAt)}</td></tr>
              <tr><th>PDF</th><td>{invoice.pdfUrl ? `/api/admin/invoices/${invoice.id}/download` : "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Positionen</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Titel</th><th>Beschreibung</th><th>Menge</th><th>Einzelpreis</th><th>Netto</th></tr></thead>
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

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Audit-Historie</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Zeit</th><th>Event</th><th>Daten</th></tr></thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{log.action}</td>
                  <td><pre>{JSON.stringify(log.newValues ?? log.oldValues ?? {}, null, 2)}</pre></td>
                </tr>
              ))}
              {auditLogs.length === 0 ? <tr><td colSpan={3}>Keine Audit-Einträge.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPortalShell>
  );
}
