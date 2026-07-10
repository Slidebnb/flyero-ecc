import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  customerOrderAction,
  customerOrderName,
  customerOrderPlainNextStep,
  customerOrderTone,
} from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerOrdersPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const orders = await prisma.order.findMany({
    where: { customer: { userId: session.id } },
    orderBy: { createdAt: "desc" },
  });
  const openPayment = orders.filter((order) => ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status)).length;
  const latestOrder = orders[0] ?? null;

  return (
    <CustomerPortalShell
      active="/customer/orders"
      title="Kampagnen"
      description="Alle Verteilungen mit dem nächsten Schritt. Eine Aktion pro Kampagne."
    >
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Schnell weiter</span>
          <h2>{latestOrder ? "Aktuelle Kampagne öffnen oder neue Verteilung starten." : "Starten Sie Ihre erste Verteilung."}</h2>
          <p>{openPayment ? `${openPayment} Zahlung wartet noch auf Abschluss.` : "FLYERO zeigt hier nur die nächsten sinnvollen Schritte."}</p>
        </div>
        <Link className="primaryButton" href="/customer/orders/new">Neue Kampagne starten</Link>
      </section>

      <DataSection title="Meine Kampagnen" description="Details öffnen Sie nur, wenn Sie sie brauchen.">
        <div className="customerCampaignList">
          {orders.map((order) => {
            const action = customerOrderAction(order.status, order.id);
            return (
              <article className="customerCampaignItem" key={order.id}>
                <div>
                  <div className="customerItemHeader">
                    <strong>{customerOrderName(order.orderNumber)}</strong>
                    <StatusBadge tone={customerOrderTone(order.status)}>{CUSTOMER_ORDER_STATUS_LABELS[order.status]}</StatusBadge>
                  </div>
                  <p>{customerOrderPlainNextStep(order.status)}</p>
                  <div className="customerItemMeta">
                    <span>{order.targetAreaName}</span>
                    <span>{formatDate(order.createdAt)}</span>
                    <span>{order.flyerQuantity.toLocaleString("de-DE")} Flyer</span>
                    <span>{formatCurrency(order.manualPriceOverride ?? order.calculatedGrossPrice)}</span>
                  </div>
                </div>
                <Link className="primaryButton" href={action.href}>{action.label}</Link>
              </article>
            );
          })}
          {orders.length === 0 ? (
            <EmptyState
              title="Noch keine Kampagnen."
              description="Starten Sie die erste Verteilung direkt online."
              action={{ href: "/customer/orders/new", label: "Neue Kampagne starten" }}
            />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
