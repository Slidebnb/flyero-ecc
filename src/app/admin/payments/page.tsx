import Link from "next/link";
import { PaymentStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

const FILTERS: Array<{ value: PaymentStatus | "REFUND"; label: string }> = [
  { value: "PAID", label: "Bezahlt" },
  { value: "CHECKOUT_CREATED", label: "Ausstehend" },
  { value: "REFUND", label: "Refund" },
  { value: "FAILED", label: "Fehlgeschlagen" },
];

export default async function AdminPaymentsPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const params = await searchParams;
  const filter = FILTERS.some((entry) => entry.value === params.status) ? params.status : undefined;
  const payments = await prisma.payment.findMany({
    where: {
      ...(filter === "REFUND"
        ? { refunds: { some: {} } }
        : filter
          ? { status: filter as PaymentStatus }
          : {}),
    },
    include: {
      order: { include: { customer: true } },
      refunds: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Payments</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/orders?status=PAID_WAITING_FOR_ADMIN_REVIEW">Bezahlte Auftraege</Link>
          <Link href="/admin/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <form className="form grid" action="/admin/payments" method="get">
          <label>
            Status
            <select name="status" defaultValue={filter ?? ""}>
              <option value="">Alle</option>
              {FILTERS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Zahlung</th>
                <th>Auftrag</th>
                <th>Kunde</th>
                <th>Status</th>
                <th>Betrag</th>
                <th>Stripe</th>
                <th>Webhookhistorie</th>
                <th>Refund ausloesen</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id.slice(-8).toUpperCase()}</td>
                  <td><Link className="textLink" href={`/admin/orders/${payment.orderId}`}>{payment.order.orderNumber}</Link></td>
                  <td>{payment.order.customer.companyName}</td>
                  <td><span className="badge">{payment.status}</span></td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? "-"}</td>
                  <td>
                    {payment.events.length ? payment.events.map((event) => (
                      <div key={event.id}>{formatDateTime(event.createdAt)} / {event.type}</div>
                    )) : "-"}
                  </td>
                  <td>
                    {["PAID", "PARTIALLY_REFUNDED"].includes(payment.status) ? (
                      <form action={`/api/admin/payments/${payment.id}/refund`} method="post" className="form">
                        <select name="reason" required defaultValue="Admin-Ablehnung">
                          <option>Admin-Ablehnung</option>
                          <option>Kunde storniert</option>
                          <option>Doppelte Zahlung</option>
                          <option>Sonstiges</option>
                        </select>
                        <button type="submit">Refund ausloesen</button>
                      </form>
                    ) : payment.refunds.length ? `${payment.refunds.length} Refund(s)` : "-"}
                  </td>
                </tr>
              ))}
              {payments.length === 0 ? <tr><td colSpan={8}>Keine Zahlungen gefunden.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
