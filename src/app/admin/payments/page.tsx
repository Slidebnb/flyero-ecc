import Link from "next/link";
import { PaymentStatus, UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

const FILTERS: Array<{ value: PaymentStatus | "REFUND"; label: string }> = [
  { value: "PAID", label: "Bezahlt" },
  { value: "CHECKOUT_CREATED", label: "Ausstehend" },
  { value: "REFUND", label: "Erstattungen" },
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
      disputes: { orderBy: { updatedAt: "desc" } },
    },
      orderBy: { updatedAt: "desc" },
  });
  const disputes = await prisma.paymentDispute.findMany({
    where: { status: "OPEN" },
    include: { payment: true, order: true, customer: true },
    orderBy: [{ dueBy: "asc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return (
    <AdminPortalShell
      title="Zahlungen"
      description="Stripe-Status, Webhookhistorie und Erstattungen zentral prüfen."
    >
      <DataSection title="Filter" description="Zahlungen nach Status oder Erstattungen eingrenzen.">
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
      </DataSection>

      <DataSection title="Offene Stripe-Zahlungsstreitfälle" description="Offene Disputes blockieren Erstattungen, bis sie geprüft und dokumentiert sind.">
        {disputes.length ? (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Dispute</th><th>Auftrag</th><th>Kunde</th><th>Betrag</th><th>Grund</th><th>Frist</th></tr></thead>
              <tbody>
                {disputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td>{dispute.stripeDisputeId}</td>
                    <td>{dispute.order ? <Link className="textLink" href={`/admin/orders/${dispute.order.id}`}>{dispute.order.orderNumber}</Link> : "Nicht zugeordnet"}</td>
                    <td>{dispute.customer?.companyName ?? "Nicht zugeordnet"}</td>
                    <td>{dispute.amount ? formatCurrency(dispute.amount) : "-"}</td>
                    <td>{dispute.reason ?? "-"}</td>
                    <td>{dispute.dueBy ? formatDateTime(dispute.dueBy) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Keine offenen Zahlungsstreitfälle." description="Neue Stripe-Disputes erscheinen hier nach Eingang des Webhooks." />}
      </DataSection>

      <DataSection title="Zahlungsliste">
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
                <th>Erstattung</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id.slice(-8).toUpperCase()}</td>
                  <td><Link className="textLink" href={`/admin/orders/${payment.orderId}`}>{payment.order.orderNumber}</Link></td>
                  <td>{payment.order.customer.companyName}</td>
                  <td><StatusBadge>{payment.status}</StatusBadge></td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>{payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? "-"}</td>
                  <td>
                    {payment.events.length ? payment.events.map((event) => (
                      <div key={event.id}>{formatDateTime(event.createdAt)} / {event.type}</div>
                    )) : "-"}
                  </td>
                  <td>
                    {["PAID", "PARTIALLY_REFUNDED"].includes(payment.status) ? (
                      <form action={`/api/admin/payments/${payment.id}/refund`} method="post" className="form compactForm">
                        <select name="reason" required defaultValue="Admin-Ablehnung">
                          <option>Admin-Ablehnung</option>
                          <option>Kunde storniert</option>
                          <option>Doppelte Zahlung</option>
                          <option>Sonstiges</option>
                        </select>
                        <button type="submit">Erstattung auslösen</button>
                      </form>
                    ) : payment.refunds.length ? `${payment.refunds.length} Erstattung(en)` : "-"}
                  </td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="Keine Zahlungen gefunden." description="Passe den Filter an oder prüfe später erneut." /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
