import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const PAYMENT_LABELS = {
  CREATED: "Offen",
  CHECKOUT_CREATED: "Offen",
  PENDING: "Offen",
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
  const openPayment = payments.find((payment) => ["CREATED", "CHECKOUT_CREATED", "PENDING", "FAILED"].includes(payment.status));
  const visiblePayments = payments.slice(0, 10);

  return (
    <CustomerPortalShell active="/customer/payments" title="Zahlungen" description="Offene Zahlung prüfen oder bezahlte Kampagne öffnen.">
      <section className={openPayment ? "customerWarningBanner" : "customerSuccessBanner"}>
        <strong>{openPayment ? "Eine Zahlung braucht Aufmerksamkeit." : "Keine offene Zahlung."}</strong>
        <span>{openPayment ? `${customerOrderName(openPayment.order.orderNumber)} · ${formatCurrency(openPayment.amount)}` : "Sobald eine neue Zahlung entsteht, steht der nächste Schritt hier."}</span>
        {openPayment ? <Link className="primaryButton" href={`/customer/orders/${openPayment.orderId}`}>Zahlung prüfen</Link> : null}
      </section>

      <DataSection title="Zahlungen" description="Die neuesten Zahlungen zuerst. Jeder Eintrag führt direkt zur passenden Kampagne.">
        <div className="customerCampaignList">
          {visiblePayments.map((payment) => (
            <article className="customerCampaignItem" key={payment.id}>
              <div>
                <div className="customerItemHeader">
                  <strong>{customerOrderName(payment.order.orderNumber)}</strong>
                  <StatusBadge tone={tone(payment.status)}>{PAYMENT_LABELS[payment.status]}</StatusBadge>
                </div>
                <p>{payment.status === "PAID" ? "Zahlung erhalten." : "Bitte Kampagne öffnen, wenn eine Zahlung offen ist."}</p>
                <div className="customerItemMeta">
                  <span>{formatCurrency(payment.amount)}</span>
                  <span>{formatDateTime(payment.paidAt ?? payment.failedAt ?? payment.refundedAt ?? payment.updatedAt)}</span>
                  <span>{payment.refunds.length ? `${payment.refunds.length} Erstattung` : "Keine Erstattung"}</span>
                </div>
              </div>
              <Link className={payment.status === "PAID" ? "secondaryButton" : "primaryButton"} href={`/customer/orders/${payment.orderId}`}>
                {payment.status === "PAID" ? "Kampagne ansehen" : "Zahlung prüfen"}
              </Link>
            </article>
          ))}
          {payments.length > visiblePayments.length ? (
            <p className="customerListHint">Weitere Zahlungen bleiben gespeichert. Die aktuell wichtigsten Einträge stehen oben.</p>
          ) : null}
          {payments.length === 0 ? (
            <EmptyState
              title="Noch keine Zahlungen vorhanden."
              description="Zahlungen entstehen, sobald eine Kampagne zur Buchung vorbereitet wird."
              action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }}
            />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
