import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const PAYMENT_LABELS = {
  CREATED: "Ausstehend",
  CHECKOUT_CREATED: "Ausstehend",
  PENDING: "Ausstehend",
  PAID: "Bezahlt",
  FAILED: "Fehlgeschlagen",
  CANCELLED: "Abgebrochen",
  REFUNDED: "Erstattet",
  PARTIALLY_REFUNDED: "Teilweise erstattet",
} as const;

export default async function CustomerPaymentsPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const payments = await prisma.payment.findMany({
    where: { customer: { userId: session.id } },
    include: { order: true, refunds: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Zahlungen</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/orders">Meine Auftraege</Link>
          <Link href="/customer/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel tableWrap widePanel">
        <table>
          <thead>
            <tr>
              <th>Auftrag</th>
              <th>Status</th>
              <th>Betrag</th>
              <th>Transaktionsdatum</th>
              <th>Stripe-Referenz</th>
              <th>Erstattungen</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td><Link className="textLink" href={`/customer/orders/${payment.orderId}`}>{payment.order.orderNumber}</Link></td>
                <td><span className="badge">{PAYMENT_LABELS[payment.status]}</span></td>
                <td>{formatCurrency(payment.amount)}</td>
                <td>{formatDateTime(payment.paidAt ?? payment.failedAt ?? payment.refundedAt ?? payment.updatedAt)}</td>
                <td>{payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? "-"}</td>
                <td>{payment.refunds.length}</td>
              </tr>
            ))}
            {payments.length === 0 ? <tr><td colSpan={6}>Noch keine Zahlungen vorhanden.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
