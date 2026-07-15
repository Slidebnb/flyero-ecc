import Link from "next/link";
import { notFound } from "next/navigation";
import { DistributionAreaPreviewMap } from "@/app/components/DistributionAreaPreviewMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import {
  CUSTOMER_ORDER_STATUS_LABELS,
  customerAreaName,
  customerOrderAction,
  customerOrderName,
  customerOrderPlainNextStep,
  customerOrderTone,
} from "@/app/customer/customerUx";
import { DataSection, StatusBadge } from "@/app/PortalComponents";
import { requireTenantSession } from "@/lib/tenant";
import {
  REMAINING_STOCK_STATUS_LABELS,
  WAREHOUSE_INVENTORY_STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { warehouseAddressText } from "@/lib/logistics";
import { getOrderPriceBreakdown } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ payment?: string; inquiry?: string }>;
};

function paymentLabel(status?: string | null) {
  if (status === "PAID") return "Bezahlt";
  if (status === "FAILED") return "Fehlgeschlagen";
  if (status === "REFUNDED" || status === "PARTIALLY_REFUNDED") return "Erstattet";
  return "Offen";
}

export default async function CustomerOrderDetailPage({ params, searchParams }: PageProps) {
  const session = await requireTenantSession();
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const order = await prisma.order.findFirst({
    where: { id, tenantId: session.tenantId, customer: { userId: session.id, tenantId: session.tenantId } },
    include: {
      statusEvents: { orderBy: { createdAt: "desc" }, take: 4 },
      distributionArea: true,
      assignedWarehouse: true,
      logisticsShipments: {
        where: { shipmentType: "CUSTOMER_TO_WAREHOUSE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      warehouseInventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) notFound();

  const latestPayment = order.payments[0] ?? null;
  const price = getOrderPriceBreakdown(order);
  const customerShipment = order.logisticsShipments[0] ?? null;
  const action = customerOrderAction(order.status, order.id);
  const warehouseLabel = order.assignedWarehouse ? `${order.assignedWarehouse.name}, ${warehouseAddressText(order.assignedWarehouse)}` : "Wird von FLYERO zugewiesen";

  if (query.payment === "success" || query.payment === "cancelled") {
    const eventType = query.payment === "success" ? "PAYMENT_RETURNED_SUCCESS" : "PAYMENT_RETURNED_CANCELLED";
    const existingEvent = await prisma.orderExperienceEvent.findFirst({
      where: { orderId: order.id, userId: session.id, eventType },
      select: { id: true },
    });
    if (!existingEvent) {
      await prisma.orderExperienceEvent.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          tenantId: session.tenantId,
          userId: session.id,
          eventType,
          source: "stripe-return",
          metadata: { paymentStatus: query.payment },
        },
      });
    }
  }

  return (
    <CustomerPortalShell
      active="/customer/orders"
      eyebrow="Kampagne"
      title={customerOrderName(order.orderNumber)}
      description={customerOrderPlainNextStep(order.status)}
    >
      {query.payment === "success" ? (
        <section className="customerSuccessBanner">
          <strong>Gebucht. FLYERO prüft jetzt Gebiet und Druckdaten.</strong>
          <span>Sie sehen jeden nächsten Schritt hier im Portal.</span>
        </section>
      ) : null}
      {query.payment === "retry" || query.payment === "cancelled" ? (
        <section className="customerWarningBanner">
          <strong>Zahlung nicht abgeschlossen.</strong>
          <span>Sie können die Zahlung erneut starten oder die Kampagne als Anfrage weiterführen.</span>
        </section>
      ) : null}
      {query.inquiry === "success" ? (
        <section className="customerSuccessBanner">
          <strong>Anfrage übermittelt.</strong>
          <span>Wir prüfen Gebiet, Druckdaten und Preis und melden uns schnellstmöglich.</span>
        </section>
      ) : null}

      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Nächster Schritt</span>
          <h2>{action.label}</h2>
          <p>{customerOrderPlainNextStep(order.status)}</p>
        </div>
        <Link className="primaryButton" href={action.href}>{action.label}</Link>
      </section>

      <section className="customerDetailActions" aria-label="Kampagnenaktionen">
        <Link className="secondaryButton" href="/customer/orders">Alle Kampagnen</Link>
        <Link className="secondaryButton" href={`/customer/orders/new?repeatFrom=${encodeURIComponent(order.id)}`}>Kampagne wiederholen</Link>
        <Link className="secondaryButton" href={`/customer/orders/${order.id}/documents`}>Dateien öffnen</Link>
        <Link className="secondaryButton" href="/customer/reports">Nachweise ansehen</Link>
      </section>

      <section className="customerDigestGrid">
        <article>
          <span>Status</span>
          <strong><StatusBadge tone={customerOrderTone(order.status)}>{CUSTOMER_ORDER_STATUS_LABELS[order.status]}</StatusBadge></strong>
        </article>
        <article>
          <span>Gesamt brutto</span>
          <strong>{formatCurrency(price.gross)}</strong>
        </article>
        <article>
          <span>Netto</span>
          <strong>{formatCurrency(price.net)}</strong>
        </article>
        <article>
          <span>MwSt. 19 %</span>
          <strong>{formatCurrency(price.vat)}</strong>
        </article>
        <article>
          <span>Flyer</span>
          <strong>{order.flyerQuantity.toLocaleString("de-DE")}</strong>
        </article>
        <article>
          <span>Wunschzeitraum</span>
          <strong>{formatDate(order.preferredStartDate)} bis {formatDate(order.preferredEndDate)}</strong>
        </article>
      </section>

      {order.status === "PAYMENT_PENDING" || order.status === "PAYMENT_FAILED" ? (
        <section className="customerFocusPanel">
          <div>
            <span className="customerTinyLabel">Zahlung</span>
            <h2>Jetzt kostenpflichtig buchen</h2>
            <p>Nach erfolgreicher Zahlung prüft FLYERO Gebiet, Druckdaten und Zustellbarkeit final.</p>
          </div>
          <form action="/api/payments/checkout" method="post">
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit">Jetzt bezahlen</button>
          </form>
        </section>
      ) : null}

      <div className="customerTwoColumn">
        <DataSection title="Planung" description="Alles Wichtige zur Verteilung auf einen Blick.">
          <div className="customerFactList">
            <p><span>Gebiet</span><strong>{customerAreaName(order.targetAreaName)}</strong></p>
            <p><span>Ort</span><strong>{order.postalCode} {order.city}</strong></p>
            <p><span>Druckdaten</span><strong>{order.customerOwnFlyers ? "Flyer werden angeliefert" : "Druck über FLYERO"}</strong></p>
            <p><span>Zahlung</span><strong>{latestPayment ? `${paymentLabel(latestPayment.status)} · ${formatCurrency(latestPayment.amount)}` : "Noch keine Zahlung"}</strong></p>
            <p><span>Lager</span><strong>{warehouseLabel}</strong></p>
            <p><span>Hinweis vom FLYERO-Team</span><strong>{order.adminCustomerMessage || "Aktuell kein Hinweis nötig."}</strong></p>
          </div>
        </DataSection>

        <DataSection title="Nachweise inklusive" description="Der Kundennachweis entsteht nach der Verteilung und internen Prüfung.">
          <div className="customerProofBullets">
            <p><strong>GPS-Nachweis</strong><span>Nachweis des eingesetzten Trackingsystems.</span></p>
            <p><strong>Foto-Dokumentation</strong><span>Nur freigegebene Fotos werden angezeigt.</span></p>
            <p><strong>PDF-Bericht</strong><span>Nach Prüfung im Portal abrufbar.</span></p>
          </div>
        </DataSection>
      </div>

      <DataSection title="Verteilgebiet" description="Gebietsdaten werden vor der Verteilung durch FLYERO geprüft.">
        <DistributionAreaPreviewMap geoJson={order.targetAreaGeoJson ?? order.distributionArea?.geoJson} />
        <div className="customerFactList compact">
          <p><span>Haushalte</span><strong>{order.estimatedHouseholds ?? order.distributionArea?.estimatedHouseholds ?? "Wird geprüft"}</strong></p>
          <p><span>Fläche</span><strong>{order.coverageAreaSqm ? `${Number(order.coverageAreaSqm).toLocaleString("de-DE")} m²` : "Wird geprüft"}</strong></p>
          <p><span>Strecke</span><strong>{order.estimatedDistanceMeters ? `${(order.estimatedDistanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km` : "Wird geprüft"}</strong></p>
        </div>
      </DataSection>

      {order.customerOwnFlyers && order.assignedWarehouse ? (
        <details className="customerSoftDetails">
          <summary>Lieferung an FLYERO ansehen</summary>
          <DataSection title="Flyer an Lager senden" description="Nur wichtig, wenn Sie eigene Flyer anliefern.">
            <div className="customerFactList">
              <p><span>Kampagnennummer</span><strong>{customerOrderName(order.orderNumber)}</strong></p>
              <p><span>Lieferadresse</span><strong>{warehouseAddressText(order.assignedWarehouse)}</strong></p>
              <p><span>Sendung</span><strong>{customerShipment?.trackingNumber ?? "Noch nicht hinterlegt"}</strong></p>
              <p><span>Status</span><strong>{customerShipment?.status ?? "Wird erwartet"}</strong></p>
            </div>
          </DataSection>
        </details>
      ) : null}

      {order.warehouseInventory ? (
        <details className="customerSoftDetails">
          <summary>Lagerstand ansehen</summary>
          <DataSection title="Lagerstatus" description="Sobald die Flyer bereit sind, plant FLYERO die Verteilung.">
            <div className="customerFactList compact">
              <p><span>Status</span><strong>{WAREHOUSE_INVENTORY_STATUS_LABELS[order.warehouseInventory.status]}</strong></p>
              <p><span>Erhalten</span><strong>{order.warehouseInventory.receivedFlyers ?? 0} von {order.warehouseInventory.expectedFlyers}</strong></p>
              <p><span>Restbestand</span><strong>{order.warehouseInventory.remainingFlyers ?? "-"} · {REMAINING_STOCK_STATUS_LABELS[order.warehouseInventory.remainingStockStatus]}</strong></p>
            </div>
          </DataSection>
        </details>
      ) : null}

      <details className="customerSoftDetails">
        <summary>Letzte Updates ansehen</summary>
        <DataSection title="Letzte Updates" description="Nur die letzten relevanten Schritte.">
          <div className="customerTimeline">
            {order.statusEvents.map((event) => (
              <p key={event.id}>
                <span>{formatDateTime(event.createdAt)}</span>
                <strong>{CUSTOMER_ORDER_STATUS_LABELS[event.toStatus]}</strong>
                <small>{event.note || "Status aktualisiert."}</small>
              </p>
            ))}
            {order.statusEvents.length === 0 ? <p><strong>Noch keine Updates.</strong><small>FLYERO meldet sich, sobald etwas passiert.</small></p> : null}
          </div>
        </DataSection>
      </details>
    </CustomerPortalShell>
  );
}
