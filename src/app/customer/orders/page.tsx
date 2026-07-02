import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerOrdersPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const orders = await prisma.order.findMany({
    where: { customer: { userId: session.id } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Meine Aufträge</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/orders/new">Neuer Auftrag</Link>
          <Link href="/customer/payments">Zahlungen</Link>
          <Link href="/customer/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel tableWrap">
        <table>
          <thead>
            <tr>
              <th>Auftrag</th>
              <th>Status</th>
              <th>Datum</th>
              <th>Stadt</th>
              <th>Preis</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td><span className="badge">{ORDER_STATUS_LABELS[order.status]}</span></td>
                <td>{formatDate(order.createdAt)}</td>
                <td>{order.city}</td>
                <td>{formatCurrency(order.manualPriceOverride ?? order.calculatedGrossPrice)}</td>
                <td>
                  <Link className="textLink" href={`/customer/orders/${order.id}`}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6}>Noch keine Aufträge vorhanden.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
