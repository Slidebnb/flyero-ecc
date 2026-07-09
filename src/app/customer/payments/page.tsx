import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
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

function tone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (status === "PAID") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "CREATED" || status === "CHECKOUT_CREATED" || status === "PENDING") return "warning";
  return "neutral";
}

export default async function CustomerPaymentsPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const payments = await prisma.payment.findMany({
    where: { customer: { userId: session.id } },
    include: { order: true, refunds: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <CustomerPortalShell active="/customer/payments" title="Zahlungen" description="Alle Zahlungen, Stripe-Referenzen und Erstattungen in einer Übersicht.">
      <section className="portalMetrics">
        <MetricTile label="Zahlungen" value={payments.length} />
        <MetricTile label="Bezahlt" value={payments.filter((payment) => payment.status === "PAID").length} tone="success" />
        <MetricTile label="Offen" value={payments.filter((payment) => ["CREATED", "CHECKOUT_CREATED", "PENDING"].includes(payment.status)).length} tone="warning" />
        <MetricTile label="Erstattungen" value={payments.reduce((sum, payment) => sum + payment.refunds.length, 0)} />
      </section>

      <DataSection title="Zahlungsübersicht">
        <div className="tableWrap customerTable">
          <table>
            <thead><tr><th>Auftrag</th><th>Status</th><th>Betrag</th><th>Datum</th><th>Referenz</th><th>Erstattungen</th></tr></thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td data-label="Auftrag"><Link className="textLink" href={`/customer/orders/${payment.orderId}`}>{payment.order.orderNumber}</Link></td>
                  <td data-label="Status"><StatusBadge tone={tone(payment.status)}>{PAYMENT_LABELS[payment.status]}</StatusBadge></td>
                  <td data-label="Betrag">{formatCurrency(payment.amount)}</td>
                  <td data-label="Datum">{formatDateTime(payment.paidAt ?? payment.failedAt ?? payment.refundedAt ?? payment.updatedAt)}</td>
                  <td data-label="Referenz">{payment.stripePaymentIntentId ?? payment.stripeCheckoutSessionId ?? "-"}</td>
                  <td data-label="Erstattungen">{payment.refunds.length}</td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Noch keine Zahlungen vorhanden."
                      description="Zahlungen entstehen, sobald eine neue Bestellung zur Buchung vorbereitet wird."
                      action={{ href: "/customer/orders/new", label: "Neue Bestellung erstellen" }}
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
