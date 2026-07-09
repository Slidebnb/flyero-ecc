import Link from "next/link";
import { UserRole } from "@prisma/client";
import { EmptyState } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminInvoicesPage() {
  await requireRole([UserRole.ADMIN]);
  const invoices = await prisma.invoice.findMany({
    include: { customer: true, order: true, payment: true, creditNotes: true },
    orderBy: { invoiceDate: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Rechnungen</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/orders">Aufträge</Link>
          <Link href="/admin/payments">Payments</Link>
          <Link href="/admin/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel tableWrap widePanel">
        <table>
          <thead>
            <tr>
              <th>Rechnung</th>
              <th>Kunde</th>
              <th>Auftrag</th>
              <th>Zahlung</th>
              <th>Status</th>
              <th>Betrag</th>
              <th>PDF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.customer.companyName}</td>
                <td>{invoice.order.orderNumber}</td>
                <td>{invoice.payment?.status ?? "-"}</td>
                <td><span className="badge">{invoice.status}</span></td>
                <td>{formatCurrency(invoice.totalGross)}</td>
                <td>{invoice.pdfUrl ? "Ja" : "Nein"}</td>
                <td><Link className="textLink" href={`/admin/invoices/${invoice.id}`}>Öffnen</Link></td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    title="Keine Rechnungen gefunden."
                    description="Rechnungen entstehen nach erfolgreicher Zahlung und Admin-Freigabe eines Auftrags."
                    action={{ href: "/admin/orders", label: "Aufträge prüfen" }}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}

