import Link from "next/link";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  customerAreaName,
  customerOrderAction,
  customerOrderName,
  customerOrderPlainNextStep,
  customerOrderTone,
} from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import { formatCurrency, formatDate } from "@/lib/format";
import { getOrderGrossPrice } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { OrderDeleteButton } from "@/app/customer/orders/OrderDeleteButton";

export default async function CustomerOrdersPage() {
  const session = await requireTenantSession();
  const orders = await prisma.order.findMany({
    where: { tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
    orderBy: { createdAt: "desc" },
  });
  const openPayment = orders.filter((order) => ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status)).length;
  const latestOrder = orders[0] ?? null;
  const visibleOrders = orders.slice(0, 10);

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
        <Link className="primaryButton" href="/customer/orders/new?fresh=1">Neue Kampagne starten</Link>
      </section>

      <DataSection title="Meine Kampagnen" description="Die neuesten Kampagnen zuerst. Pro Kampagne gibt es genau die nächste sinnvolle Aktion.">
        <div className="customerCampaignList">
          {visibleOrders.map((order) => {
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
                    <span>{customerAreaName(order.targetAreaName)}</span>
                    <span>{formatDate(order.createdAt)}</span>
                    <span>{order.flyerQuantity.toLocaleString("de-DE")} Flyer</span>
                    <span>Gesamt brutto {formatCurrency(getOrderGrossPrice(order))}</span>
                  </div>
                </div>
                <div className="customerCampaignActions">
                  <Link className="primaryButton" href={action.href}>{action.label}</Link>
                  {["DRAFT", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status) ? (
                    <OrderDeleteButton orderId={order.id} orderLabel={customerOrderName(order.orderNumber)} />
                  ) : null}
                </div>
              </article>
            );
          })}
          {orders.length > visibleOrders.length ? (
            <p className="customerListHint">Weitere Kampagnen bleiben gespeichert. Die aktuell wichtigsten Einträge stehen oben.</p>
          ) : null}
          {orders.length === 0 ? (
            <EmptyState
              title="Noch keine Kampagnen."
              description="Starten Sie die erste Verteilung direkt online."
              action={{ href: "/customer/orders/new?fresh=1", label: "Neue Kampagne starten" }}
            />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
