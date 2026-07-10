import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { CUSTOMER_ORDER_STATUS_LABELS, customerOrderName } from "@/app/customer/customerUx";
import { requireRole } from "@/lib/auth";
import {
  REMAINING_STOCK_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  WAREHOUSE_INVENTORY_STATUS_LABELS,
} from "@/lib/constants";
import { formatAddress, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { warehouseAddressText } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ payment?: string; inquiry?: string }>;
};

export default async function CustomerOrderDetailPage({ params, searchParams }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
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
  const paymentStatusLabel = latestPayment?.status === "PAID" ? "Bezahlt" : latestPayment?.status === "FAILED" ? "Fehlgeschlagen" : "Offen";
  const pickupLabel = order.warehouseInventory?.pickupStatus === "RESERVED"
    ? "Reserviert"
    : order.warehouseInventory?.pickupStatus === "PICKED_UP"
      ? "Abgeholt"
      : order.warehouseInventory?.pickupStatus === "PREPARED"
        ? "Vorbereitet"
        : "In Planung";

  return (
    <CustomerPortalShell active="/customer/orders" eyebrow="Kampagnendetails" title={customerOrderName(order.orderNumber)} description={CUSTOMER_ORDER_STATUS_LABELS[order.status]}>
      {query.payment === "success" ? (
        <section className="panel stack widePanel">
          <h2 className="sectionTitle">Deine Kampagne wurde gebucht.</h2>
          <p className="muted">Wir prüfen Gebiet und Druckdaten und halten dich über den Status auf dem Laufenden.</p>
        </section>
      ) : null}
      {query.payment === "retry" || query.payment === "cancelled" ? (
        <section className="panel stack widePanel">
          <h2 className="sectionTitle">Zahlung konnte nicht abgeschlossen werden.</h2>
          <p className="muted">Du kannst die Zahlung erneut versuchen oder die Kampagne als Anfrage senden.</p>
        </section>
      ) : null}
      {query.inquiry === "success" ? (
        <section className="panel stack widePanel">
          <h2 className="sectionTitle">Deine Anfrage wurde übermittelt.</h2>
          <p className="muted">Wir prüfen Gebiet, Druckdaten und Preis und melden uns schnellstmöglich.</p>
        </section>
      ) : null}

      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/orders">Meine Kampagnen</Link>
        <Link className="secondaryButton" href={`/customer/orders/${order.id}/documents`}>Dateien & Druck</Link>
        <Link className="primaryButton" href="/customer/orders/new">Neue Kampagne</Link>
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
                Die Kampagne wird erst nach erfolgreicher Zahlung zur Prüfung freigegeben.
              </p>
            </div>
            <span className="badge warning">{CUSTOMER_ORDER_STATUS_LABELS[order.status]}</span>
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
                <tr><th>Status</th><td>{paymentStatusLabel}</td></tr>
                <tr><th>Betrag</th><td>{formatCurrency(latestPayment.amount)}</td></tr>
                <tr><th>Transaktionsdatum</th><td>{formatDateTime(latestPayment.paidAt ?? latestPayment.updatedAt)}</td></tr>
                <tr><th>Zahlungsreferenz</th><td>{latestPayment.stripeCheckoutSessionId ?? latestPayment.stripePaymentIntentId ?? "-"}</td></tr>
                <tr><th>Erstattungen</th><td>{latestPayment.refunds.length}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Kampagne</h2>
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
              <tr><th>Hinweis vom FLYERO-Team</th><td>{order.adminCustomerMessage || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Nachweise inklusive</h2>
        <p className="muted">GPS-Nachweis, Foto-Dokumentation und PDF-Bericht sind im Ablauf enthalten. Der Bericht wird nach der Verteilung erstellt.</p>
      </section>

      {order.customerOwnFlyers && order.assignedWarehouse ? (
        <section className="panel stack" style={{ marginTop: 18 }}>
          <h2 className="sectionTitle">Flyer an Lager senden</h2>
          <p className="muted">
            Bitte schreibe die Kampagnennummer gut sichtbar auf jedes Paket: <strong>{customerOrderName(order.orderNumber)}</strong>
          </p>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Zuständiges Lager</th><td>{order.assignedWarehouse.name}</td></tr>
                <tr><th>Lieferadresse</th><td>{warehouseAddressText(order.assignedWarehouse)}</td></tr>
                <tr><th>Sendungsstatus</th><td>{customerShipment?.status ?? "CREATED"}</td></tr>
                <tr><th>Tracking</th><td>{customerShipment?.trackingNumber ?? "-"}</td></tr>
                <tr><th>Hinweis</th><td>Wir melden uns, sobald die Flyer geprüft und zur Verteilung eingeplant sind.</td></tr>
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
              <tr><th>Haushalte geschätzt</th><td>{order.estimatedHouseholds ?? order.distributionArea?.estimatedHouseholds ?? "-"}</td></tr>
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
                <tr><th>Abholung</th><td>{pickupLabel}</td></tr>
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
                  <td>{CUSTOMER_ORDER_STATUS_LABELS[event.toStatus]}</td>
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
