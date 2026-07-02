import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function tone(status: string): "neutral" | "success" | "warning" | "danger" {
  if (["DISTRIBUTION_APPROVED", "REPORT_READY_PREVIEW"].includes(status)) return "success";
  if (["PAYMENT_FAILED", "REJECTED", "CANCELLED"].includes(status)) return "danger";
  if (["PAYMENT_PENDING", "WAITING_FOR_CUSTOMER", "PAID_WAITING_FOR_ADMIN_REVIEW"].includes(status)) return "warning";
  return "neutral";
}

export default async function CustomerOrdersPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const orders = await prisma.order.findMany({
    where: { customer: { userId: session.id } },
    orderBy: { createdAt: "desc" },
  });
  const active = orders.filter((order) => !["DISTRIBUTION_APPROVED", "CANCELLED", "REJECTED"].includes(order.status)).length;
  const finished = orders.filter((order) => ["DISTRIBUTION_APPROVED", "REPORT_READY_PREVIEW"].includes(order.status)).length;
  const openPayment = orders.filter((order) => ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status)).length;

  return (
    <CustomerPortalShell
      active="/customer/orders"
      title="Bestellungen"
      description="Alle Kampagnen, Status, Preise und Aktionen in einer klaren Übersicht."
    >
      <section className="portalMetrics">
        <MetricTile label="Bestellungen" value={orders.length} />
        <MetricTile label="Aktiv" value={active} tone="success" />
        <MetricTile label="Zahlung offen" value={openPayment} tone={openPayment ? "warning" : "success"} />
        <MetricTile label="Abgeschlossen" value={finished} />
      </section>

      <DataSection title="Meine Bestellungen" description="Neue Kampagnen starten direkt im Karten-Flow. Bestehende Aufträge bleiben vollständig nachvollziehbar.">
        <div className="customerActionRow">
          <Link className="secondaryButton" href="/customer/orders/new">Neue Bestellung erstellen<span aria-hidden="true">→</span></Link>
          <Link className="secondaryButton" href="/customer/documents">Druckdaten verwalten</Link>
        </div>
        <div className="tableWrap customerTable">
          <table>
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Status</th>
                <th>Datum</th>
                <th>Gebiet</th>
                <th>Flyer</th>
                <th>Preis</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Auftrag"><strong>{order.orderNumber}</strong></td>
                  <td data-label="Status"><StatusBadge tone={tone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></td>
                  <td data-label="Datum">{formatDate(order.createdAt)}</td>
                  <td data-label="Gebiet">{order.targetAreaName}<br /><small>{order.postalCode} {order.city}</small></td>
                  <td data-label="Flyer">{order.flyerQuantity.toLocaleString("de-DE")}</td>
                  <td data-label="Preis">{formatCurrency(order.manualPriceOverride ?? order.calculatedGrossPrice)}</td>
                  <td data-label="Aktion"><Link className="textLink" href={`/customer/orders/${order.id}`}>Öffnen</Link></td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="Noch keine Bestellungen." action={{ href: "/customer/orders/new", label: "Neue Bestellung erstellen" }} /></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
