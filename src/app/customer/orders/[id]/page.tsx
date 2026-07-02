import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { requireRole } from "@/lib/auth";
import {
  ORDER_STATUS_LABELS,
  REMAINING_STOCK_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  WAREHOUSE_INVENTORY_STATUS_LABELS,
} from "@/lib/constants";
import { formatAddress, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { warehouseAddressText } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerOrderDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, customer: { userId: session.id } },
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
      distributionArea: {
        include: {
          estimates: { orderBy: { createdAt: "desc" }, take: 1 },
          polygons: { orderBy: { sortOrder: "asc" } },
        },
      },
      assignedWarehouse: true,
      logisticsShipments: {
        where: { shipmentType: "CUSTOMER_TO_WAREHOUSE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      warehouseInventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
      payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    notFound();
  }
  const latestPayment = order.payments[0] ?? null;
  const customerShipment = order.logisticsShipments[0] ?? null;

  return (
    <CustomerPortalShell active="/customer/orders" eyebrow="Auftragsdetails" title={order.orderNumber} description={ORDER_STATUS_LABELS[order.status]}>
      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/orders">Meine Aufträge</Link>
        <Link className="secondaryButton" href={`/customer/orders/${order.id}/documents`}>Dokumente</Link>
        <Link className="primaryButton" href="/customer/orders/new">Neuer Auftrag</Link>
      </div>

      <section className="gridCards">
        <article className="card">
          <strong>{formatCurrency(order.manualPriceOverride ?? order.calculatedGrossPrice)}</strong>
          <span>Preis brutto</span>
        </article>
        <article className="card">
          <strong>{order.flyerQuantity}</strong>
          <span>Flyer</span>
        </article>
        <article className="card">
          <strong>{formatDate(order.preferredStartDate)}</strong>
          <span>Wunschtermin</span>
        </article>
        <article className="card">
          <strong>{order.city}</strong>
          <span>Gebiet</span>
        </article>
      </section>

      {order.status === "PAYMENT_PENDING" || order.status === "PAYMENT_FAILED" ? (
        <section className="panel stack widePanel" style={{ marginTop: 18 }}>
          <div className="splitHeader">
            <div>
              <p className="eyebrow">Vorkasse</p>
              <h2 className="sectionTitle">Jetzt kostenpflichtig buchen</h2>
              <p className="muted">
                Der Auftrag wird erst nach erfolgreicher Stripe-Zahlung an die Adminprüfung übergeben.
              </p>
            </div>
            <span className="badge warning">{ORDER_STATUS_LABELS[order.status]}</span>
          </div>
          <form action="/api/payments/checkout" method="post" className="actions">
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit">Jetzt kostenpflichtig buchen</button>
          </form>
        </section>
      ) : null}

      {latestPayment ? (
        <section className="panel stack" style={{ marginTop: 18 }}>
          <h2 className="sectionTitle">Zahlung</h2>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Status</th><td>{latestPayment.status}</td></tr>
                <tr><th>Betrag</th><td>{formatCurrency(latestPayment.amount)}</td></tr>
                <tr><th>Transaktionsdatum</th><td>{formatDateTime(latestPayment.paidAt ?? latestPayment.updatedAt)}</td></tr>
                <tr><th>Stripe-Referenz</th><td>{latestPayment.stripeCheckoutSessionId ?? latestPayment.stripePaymentIntentId ?? "-"}</td></tr>
                <tr><th>Erstattungen</th><td>{latestPayment.refunds.length}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Auftrag</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Leistung</th><td>{SERVICE_TYPE_LABELS[order.serviceType]}</td></tr>
              <tr><th>Gebiet</th><td>{order.targetAreaName}</td></tr>
              <tr><th>Adresse</th><td style={{ whiteSpace: "pre-line" }}>{formatAddress(order.targetAddress)}</td></tr>
              <tr><th>Zeitraum</th><td>{formatDate(order.preferredStartDate)} bis {formatDate(order.preferredEndDate)}</td></tr>
              <tr><th>Flexible Planung</th><td>{order.flexibleScheduling ? "Ja" : "Nein"}</td></tr>
              <tr><th>Flyerquelle</th><td>{order.customerOwnFlyers ? "Kunde hat Flyer" : "Druck benötigt"}</td></tr>
              <tr><th>Eigene Notizen</th><td>{order.notes || "-"}</td></tr>
              <tr><th>Adminhinweis</th><td>{order.adminCustomerMessage || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {order.customerOwnFlyers && order.assignedWarehouse ? (
        <section className="panel stack" style={{ marginTop: 18 }}>
          <h2 className="sectionTitle">Flyer an Lager senden</h2>
          <p className="muted">
            Bitte schreibe die Auftragsnummer gut sichtbar auf jedes Paket: <strong>{order.orderNumber}</strong>
          </p>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Zuständiges Lager</th><td>{order.assignedWarehouse.name}</td></tr>
                <tr><th>Lieferadresse</th><td>{warehouseAddressText(order.assignedWarehouse)}</td></tr>
                <tr><th>Sendungsstatus</th><td>{customerShipment?.status ?? "CREATED"}</td></tr>
                <tr><th>Tracking</th><td>{customerShipment?.trackingNumber ?? "-"}</td></tr>
                <tr><th>Hinweis</th><td>Die interne Lagerauslastung ist nicht Teil der Kundenansicht.</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Verteilgebiet</h2>
        <DistributionAreaPreviewMap geoJson={order.distributionArea?.geoJson ?? order.targetAreaGeoJson} />
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Name</th><td>{order.distributionArea?.name ?? order.targetAreaName}</td></tr>
              <tr><th>Typ</th><td>{order.distributionArea?.type ?? "-"}</td></tr>
              <tr><th>Haushalte</th><td>{order.estimatedHouseholds ?? order.distributionArea?.estimatedHouseholds ?? "-"}</td></tr>
              <tr><th>Flyer geschätzt</th><td>{order.estimatedFlyers ?? order.distributionArea?.estimatedFlyers ?? "-"}</td></tr>
              <tr><th>Fläche</th><td>{order.coverageAreaSqm ? `${Number(order.coverageAreaSqm).toLocaleString("de-DE")} m²` : "-"}</td></tr>
              <tr><th>Strecke geschätzt</th><td>{order.estimatedDistanceMeters ? `${(order.estimatedDistanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {order.warehouseInventory ? (
        <section className="panel stack" style={{ marginTop: 18 }}>
          <h2 className="sectionTitle">Lagerstatus</h2>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Status</th><td>{WAREHOUSE_INVENTORY_STATUS_LABELS[order.warehouseInventory.status]}</td></tr>
                <tr><th>Lagerplatz</th><td>{order.warehouseInventory.warehouseLocation ? `${order.warehouseInventory.warehouseLocation.warehouse.name} / ${order.warehouseInventory.warehouseLocation.fullLabel}` : "Noch nicht zugewiesen"}</td></tr>
                <tr><th>Erwartete Flyer</th><td>{order.warehouseInventory.expectedFlyers}</td></tr>
                <tr><th>Erhaltene Flyer</th><td>{order.warehouseInventory.receivedFlyers ?? "-"}</td></tr>
                <tr><th>Restbestand</th><td>{order.warehouseInventory.remainingFlyers ?? "-"} / {REMAINING_STOCK_STATUS_LABELS[order.warehouseInventory.remainingStockStatus]}</td></tr>
                <tr><th>Abholung</th><td>{order.warehouseInventory.pickupStatus}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Historie</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Zeitpunkt</th><th>Status</th><th>Notiz</th></tr>
            </thead>
            <tbody>
              {order.statusEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.createdAt)}</td>
                  <td>{ORDER_STATUS_LABELS[event.toStatus]}</td>
                  <td>{event.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </CustomerPortalShell>
  );
}
