import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerInvoicesPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const invoices = await prisma.invoice.findMany({
    where: { customer: { userId: session.id } },
    include: { order: true, payment: true },
    orderBy: { invoiceDate: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Rechnungen</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/orders">Auftraege</Link>
          <Link href="/customer/payments">Zahlungen</Link>
          <Link href="/customer/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel tableWrap widePanel">
        <table>
          <thead>
            <tr>
              <th>Rechnung</th>
              <th>Auftrag</th>
              <th>Status</th>
              <th>Datum</th>
              <th>Betrag</th>
              <th>PDF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.order.orderNumber}</td>
                <td><span className="badge success">{invoice.status}</span></td>
                <td>{formatDate(invoice.invoiceDate ?? invoice.createdAt)}</td>
                <td>{formatCurrency(invoice.totalGross)}</td>
                <td>{invoice.pdfUrl ? <a className="textLink" href={`/api/customer/invoices/${invoice.id}/download`}>Download</a> : "-"}</td>
                <td><Link className="textLink" href={`/customer/invoices/${invoice.id}`}>Ansehen</Link></td>
              </tr>
            ))}
            {invoices.length === 0 ? <tr><td colSpan={7}>Noch keine Rechnungen vorhanden.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
