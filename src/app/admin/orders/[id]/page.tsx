import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { requireRole } from "@/lib/auth";
import {
  DISPATCH_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
  SERVICE_TYPE_LABELS,
} from "@/lib/constants";
import { getSuitableDistributors } from "@/lib/dispatch";
import { formatAddress, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getOrderGrossPrice } from "@/lib/pricing";

type PageProps = {
  params: Promise<{ id: string }>;
};

type OrderSnapshot = {
  completionPath?: string;
  printDataStatus?: string;
  customerFacingPriceLabel?: string;
  reviewNotice?: string;
  areaCalculationSnapshot?: {
    confidence?: string;
    source?: string;
    householdCountSource?: string;
    pricingVersion?: string;
    householdCount?: number;
    areaKm2?: number;
  } | null;
};

const COMPLETION_PATH_LABELS: Record<string, string> = {
  direct_payment: "Direktbuchung mit Zahlung",
  inquiry: "Unverbindliche Anfrage",
  document_email: "Formular/E-Mail",
};

const PRINT_STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Druckdaten vorhanden",
  UPLOAD_LATER: "Druckdaten fehlen noch",
  PRINT_REQUESTED: "Druck über FLYERO angefragt",
};

export default async function AdminOrderDetailPage({ params }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: { include: { user: { select: { id: true, email: true, role: true, status: true } } } },
      assignedWarehouse: true,
      warehouseInventory: {
        include: {
          warehouseLocation: { include: { warehouse: true } },
        },
      },
      dispatchAssignments: {
        include: { distributor: true },
        orderBy: { updatedAt: "desc" },
      },
      payments: { include: { refunds: true }, orderBy: { createdAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      reports: { orderBy: { updatedAt: "desc" } },
      distributionSegments: { orderBy: { sortOrder: "asc" } },
      statusEvents: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, email: true, role: true } } },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const allowedNext = ORDER_STATUS_TRANSITIONS[order.status];
  const latestPayment = order.payments[0] ?? null;
  const snapshot = order.priceRuleSnapshot as OrderSnapshot;
  const areaSnapshot = snapshot.areaCalculationSnapshot;
  const distributorRecommendations =
    order.warehouseInventory?.status === "READY_FOR_PICKUP"
      ? await getSuitableDistributors(order.id)
      : [];
  const approvedDistributors = await prisma.distributorProfile.findMany({
    where: { reviewStatus: "APPROVED" },
    select: { id: true, firstName: true, lastName: true, phone: true, federalState: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <AdminPortalShell eyebrow="Adminbereich" title={order.orderNumber}>
      <div className="portalActions"><span className="badge">{ORDER_STATUS_LABELS[order.status]}</span><Link href="/admin/orders">Alle Aufträge</Link></div>

      <section className="gridCards">
        <article className="card">
          <strong>{formatCurrency(getOrderGrossPrice(order))}</strong>
          <span>Aktueller Preis</span>
        </article>
        <article className="card">
          <strong>{order.flyerQuantity}</strong>
          <span>Flyer</span>
        </article>
        <article className="card">
          <strong>{order.city}</strong>
          <span>Stadt</span>
        </article>
        <article className="card">
          <strong>{formatDate(order.createdAt)}</strong>
          <span>Erstellt</span>
        </article>
      </section>

      {order.status === "PAID_WAITING_FOR_ADMIN_REVIEW" ? (
        <section className="panel stack widePanel" style={{ marginTop: 18 }}>
          <div className="splitHeader">
            <div>
              <p className="eyebrow">Bezahlter Auftrag</p>
              <h2 className="sectionTitle">Adminprüfung nach Zahlung</h2>
              <p className="muted">
                Dieser Auftrag wurde per Vorkasse bezahlt. Erst nach Genehmigung darf er in Lager, Disposition und Verteilung weiterlaufen.
              </p>
            </div>
            <span className="badge success">Bezahlt</span>
          </div>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Zahlung</th><td>{latestPayment ? `${formatCurrency(latestPayment.amount)} / ${latestPayment.status}` : "-"}</td></tr>
                <tr><th>Stripe-Referenz</th><td>{latestPayment?.stripePaymentIntentId ?? latestPayment?.stripeCheckoutSessionId ?? "-"}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="reviewActions">
            <form action={`/api/admin/orders/${order.id}/status`} method="post" className="form">
              <input type="hidden" name="status" value="APPROVED" />
              <textarea name="adminCustomerMessage" placeholder="Kundenhinweis: Bitte Flyer einsenden." defaultValue="Bitte senden Sie die Flyer an das Lager." />
              <button type="submit">Genehmigen</button>
            </form>
            <form action={`/api/admin/orders/${order.id}/status`} method="post" className="form">
              <input type="hidden" name="status" value="REJECTED" />
              <label>
                Ablehnungsgrund
                <select name="refundReason" required defaultValue="Gebiet nicht bedienbar">
                  <option>Gebiet nicht bedienbar</option>
                  <option>Auftrag unvollständig</option>
                  <option>Leistung nicht verfügbar</option>
                  <option>Sonstiges</option>
                </select>
              </label>
              <textarea name="note" placeholder="Interne Notiz zur Ablehnung" />
              <button type="submit">Ablehnen und erstatten</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <div className="splitHeader">
          <div>
            <p className="eyebrow">MVP mit externem GPS-Gerät</p>
            <h2 className="sectionTitle">Verteilnachweise</h2>
            <p className="muted">
              Lade den GPS-Nachweis des eingesetzten Trackingsystems, Fotos und weitere Dateien hoch. Kunden sehen nur freigegebene Nachweise.
            </p>
          </div>
          {order.reports[0] ? <Link className="textLink" href={`/admin/reports/${order.reports[0].id}`}>Aktuellen Bericht öffnen</Link> : null}
        </div>

        <form action={`/api/admin/orders/${order.id}/evidence`} method="post" encType="multipart/form-data" className="form grid">
          <label>
            Nachweisart
            <select name="evidenceType" defaultValue="GPS_PDF">
              <option value="GPS_PDF">GPS-Bericht hochladen</option>
              <option value="GPS_FILE">GPS-Datei optional GPX/KML/KMZ</option>
              <option value="PHOTO">Fotos hochladen</option>
              <option value="OTHER">Sonstige Dokumente</option>
            </select>
          </label>
          <label>
            Anbieter optional
            <input name="providerName" placeholder="GPS-Anbieter" />
          </label>
          <label>
            Tour-/Gerätereferenz optional
            <input name="externalReportReference" />
          </label>
          <label>
            Berichtdatum optional
            <input name="reportDate" type="date" />
          </label>
          <label className="full">
            Datei
            <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gpx,.kml,.kmz" required />
          </label>
          <button type="submit">GPS-Bericht hochladen</button>
        </form>

        <form action={`/api/admin/orders/${order.id}/evidence/prepare-report`} method="post" className="form grid">
          <label>
            Verteilungsdatum
            <input name="distributionDate" type="date" />
          </label>
          <label>
            Startzeit
            <input name="startTime" type="datetime-local" />
          </label>
          <label>
            Endzeit
            <input name="endTime" type="datetime-local" />
          </label>
          <label>
            Tatsächlich verteilte Flyer
            <input name="deliveredFlyerQuantity" type="number" min="0" defaultValue={order.flyerQuantity} />
          </label>
          <label>
            Restmenge
            <input name="remainingFlyerQuantity" type="number" min="0" />
          </label>
          <label>
            Bestehenden Verteiler auswählen
            <select name="distributorId" defaultValue={order.assignedDistributorId ?? ""}>
              <option value="">Kein bestehender Verteiler ausgewählt</option>
              {approvedDistributors.map((distributor) => (
                <option key={distributor.id} value={distributor.id}>
                  {distributor.firstName} {distributor.lastName}
                  {distributor.federalState ? ` / ${distributor.federalState}` : ""}
                  {distributor.phone ? ` / ${distributor.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Verteiler / Team manuell
            <input name="distributorName" placeholder="Name oder internes Team ohne Login" />
          </label>
          <label className="full">
            Zusammenfassung
            <textarea name="summary" placeholder="Nachweis basiert auf externem GPS-Bericht und manueller Prüfung." />
          </label>
          <label className="full">
            Abweichungen
            <textarea name="deviationSummary" placeholder="Baustelle, Sperrbereich, Wetter oder sonstige Hinweise" />
          </label>
          <label className="full">
            Interne Notiz
            <textarea name="internalNote" />
          </label>
          <label className="full">
            Kundensichtbare Notiz
            <textarea name="customerNote" />
          </label>
          <button type="submit">Bericht vorbereiten</button>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Datei</th><th>Typ</th><th>Anbieter</th><th>Status</th><th>Kundensichtbar</th><th>Upload</th></tr>
            </thead>
            <tbody>
              {order.documents.map((document) => (
                <tr key={document.id}>
                  <td>{document.title}</td>
                  <td>{document.extension.toUpperCase()}</td>
                  <td>{document.providerName || "-"}</td>
                  <td>{document.status}</td>
                  <td>{document.customerVisible ? "Ja" : "Nein"}</td>
                  <td>{formatDateTime(document.uploadedAt)}</td>
                </tr>
              ))}
              {order.documents.length === 0 ? <tr><td colSpan={6}>Noch keine Verteilnachweise hochgeladen.</td></tr> : null}
            </tbody>
          </table>
        </div>

        {order.reports[0] ? (
          <div className="actions">
            <form action={`/api/admin/reports/${order.reports[0].id}/approve`} method="post"><button type="submit">Bericht freigeben</button></form>
            <form action={`/api/admin/reports/${order.reports[0].id}/publish`} method="post"><button type="submit">Bericht veröffentlichen</button></form>
          </div>
        ) : null}
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Auftragsdaten</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{order.customer.companyName} ({order.customer.user.email})</td></tr>
              <tr><th>Leistung</th><td>{SERVICE_TYPE_LABELS[order.serviceType]}</td></tr>
              <tr><th>Abschlussweg</th><td>{COMPLETION_PATH_LABELS[snapshot.completionPath ?? ""] ?? "Nicht hinterlegt"}</td></tr>
              <tr><th>Zahlung</th><td>{latestPayment ? `${formatCurrency(latestPayment.amount)} / ${latestPayment.status}` : "Keine Zahlung gestartet"}</td></tr>
              <tr><th>Druckdaten</th><td>{PRINT_STATUS_LABELS[snapshot.printDataStatus ?? ""] ?? (order.needsPrintService ? "Druck über FLYERO angefragt" : "Noch zu prüfen")}</td></tr>
              <tr><th>Gebiet</th><td>{order.targetAreaName}</td></tr>
              <tr><th>Teilgebiete</th><td>{order.distributionSegments.length > 0 ? order.distributionSegments.map((segment) => `${segment.name}${segment.city ? ` (${segment.city})` : ""}`).join(", ") : "Einzelgebiet"}</td></tr>
              <tr><th>Gebietsdaten</th><td>{areaSnapshot?.confidence ? `${areaSnapshot.confidence} / ${areaSnapshot.source ?? "verfügbare Gebietsdaten"}` : "Nach Prüfung bestätigen"}</td></tr>
              <tr><th>Prüfhinweis</th><td>{snapshot.reviewNotice ?? "Gebiet, Druckdaten und Zustellbarkeit final prüfen."}</td></tr>
              <tr><th>Adresse</th><td style={{ whiteSpace: "pre-line" }}>{formatAddress(order.targetAddress)}</td></tr>
              <tr><th>Zeitraum</th><td>{formatDate(order.preferredStartDate)} bis {formatDate(order.preferredEndDate)}</td></tr>
              <tr><th>Flexible Planung</th><td>{order.flexibleScheduling ? "Ja" : "Nein"}</td></tr>
              <tr><th>Flyerquelle</th><td>{order.customerOwnFlyers ? "Kunde hat Flyer" : "Druck benötigt"}</td></tr>
              <tr><th>Zuständiges Lager</th><td>{order.assignedWarehouse ? `${order.assignedWarehouse.name} (${order.assignedWarehouse.code})` : "-"}</td></tr>
              <tr><th>Lagerzuweisung</th><td>{order.warehouseAssignmentReason || "-"}</td></tr>
              <tr><th>Kundennotizen</th><td>{order.notes || "-"}</td></tr>
              <tr><th>Interne Notiz</th><td>{order.adminInternalNotes || "-"}</td></tr>
              <tr><th>Kundenhinweis</th><td>{order.adminCustomerMessage || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Status ändern</h2>
        <form action={`/api/admin/orders/${order.id}/status`} method="post" className="form grid">
          <input type="hidden" name="_method" value="PATCH" />
          <label>
            Neuer Status
            <select name="status" required>
              {allowedNext.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kundennotiz optional
            <input name="adminCustomerMessage" />
          </label>
          <label className="full">
            Interne Notiz optional
            <textarea name="note" />
          </label>
          <button type="submit" disabled={allowedNext.length === 0}>
            Status speichern
          </button>
        </form>
      </section>

      {order.warehouseInventory ? (
        <section className="panel stack widePanel" style={{ marginTop: 18 }}>
          <div className="splitHeader">
            <div>
              <h2 className="sectionTitle">Disposition</h2>
              <p className="muted">
                Lager: {order.warehouseInventory.warehouseLocation?.warehouse.name ?? "-"} /
                {" "}{order.warehouseInventory.warehouseLocation?.fullLabel ?? "-"} /
                Status: {order.warehouseInventory.pickupStatus}
              </p>
            </div>
            <Link className="textLink" href="/admin/dispatch">Dispatch öffnen</Link>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>Verteiler</th><th>Stadt</th><th>Distanz</th><th>Offene Touren</th><th>Kapazität</th><th>Rating</th><th></th></tr>
              </thead>
              <tbody>
                {distributorRecommendations.map((recommendation) => (
                  <tr key={recommendation.distributorId}>
                    <td>{recommendation.name}</td>
                    <td>{recommendation.city || "-"}</td>
                    <td>{recommendation.distanceKm.toFixed(0)} km</td>
                    <td>{recommendation.openTours}</td>
                    <td>{recommendation.capacityWarning ? "Kapazität überschritten" : "OK"}</td>
                    <td>{recommendation.rating.toFixed(1)}</td>
                    <td>
                      <form action={`/api/admin/orders/${order.id}/assign`} method="post">
                        <input type="hidden" name="distributorId" value={recommendation.distributorId} />
                        <button type="submit">Zuweisen</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {distributorRecommendations.length === 0 ? (
                  <tr><td colSpan={7}>Keine passenden Verteiler gefunden oder Auftrag noch nicht abholbereit.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>Zeitpunkt</th><th>Verteiler</th><th>Status</th><th>Ablehnungsgrund</th></tr>
              </thead>
              <tbody>
                {order.dispatchAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{formatDateTime(assignment.updatedAt)}</td>
                    <td>{assignment.distributor.firstName} {assignment.distributor.lastName}</td>
                    <td>{DISPATCH_STATUS_LABELS[assignment.status]}</td>
                    <td>{assignment.rejectionReason ?? "-"}</td>
                  </tr>
                ))}
                {order.dispatchAssignments.length === 0 ? <tr><td colSpan={4}>Noch keine Dispatch-Historie.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Preis ändern</h2>
        <form action={`/api/admin/orders/${order.id}/price`} method="post" className="form grid">
          <input type="hidden" name="_method" value="PATCH" />
          <label>
            Manueller Preis netto
            <input
              name="manualPriceOverride"
              type="number"
              min="1"
              step="0.01"
              defaultValue={order.manualPriceOverride?.toString() || ""}
              required
            />
          </label>
          <label>
            Notiz
            <input name="note" />
          </label>
          <button type="submit">Preis speichern</button>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Notizen</h2>
        <form action={`/api/admin/orders/${order.id}/note`} method="post" className="form grid">
          <input type="hidden" name="_method" value="PATCH" />
          <label>
            Interne Notiz
            <textarea name="adminInternalNotes" defaultValue={order.adminInternalNotes || ""} />
          </label>
          <label>
            Kundennotiz
            <textarea name="adminCustomerMessage" defaultValue={order.adminCustomerMessage || ""} />
          </label>
          <button type="submit">Notizen speichern</button>
        </form>
      </section>

      <section className="panel stack" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Historie</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Zeitpunkt</th><th>Von</th><th>Nach</th><th>Notiz</th></tr>
            </thead>
            <tbody>
              {order.statusEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.createdAt)}</td>
                  <td>{event.fromStatus ? ORDER_STATUS_LABELS[event.fromStatus] : "-"}</td>
                  <td>{ORDER_STATUS_LABELS[event.toStatus]}</td>
                  <td>{event.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPortalShell>
  );
}
