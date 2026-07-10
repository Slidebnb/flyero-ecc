import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { RouteMap } from "@/app/components/RouteMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerAreaName, customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { DataSection, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { collectReportData, sanitizeReportForCustomer } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { createTicket } from "@/lib/support";

type PageProps = { params: Promise<{ id: string }> };

function secondsLabel(seconds?: number | null) {
  if (!seconds) return "Wird geprüft";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} Min.`;
}

function reportSnapshotValue(snapshot: unknown, key: string) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

async function createComplaintTicket(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const reportId = String(formData.get("reportId"));
  const current = await prisma.report.findFirst({
    where: { id: reportId, status: "PUBLISHED", customer: { userId: session.id } },
    select: { reportNumber: true, orderId: true, tourId: true },
  });
  if (!current) notFound();
  const ticket = await createTicket(session, {
    type: TicketType.COMPLAINT,
    priority: TicketPriority.HIGH,
    subject: `Problem zu ${customerReportName(current.reportNumber)}`,
    description: "Kunde hat im Verteilbericht ein Problem gemeldet. Bitte Bericht, Tourdaten, GPS-Prüfung und Fotodokumentation prüfen.",
    reportId,
    orderId: current.orderId,
    tourId: current.tourId,
  });
  redirect(`/customer/support/tickets/${ticket.id}`);
}

export default async function CustomerReportDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: {
      id,
      status: "PUBLISHED",
      order: { customer: { userId: session.id } },
      tour: { status: "APPROVED" },
    },
    include: {
      order: {
        include: {
          documents: {
            where: { customerVisible: true, status: "APPROVED" },
            orderBy: { uploadedAt: "desc" },
          },
        },
      },
      tour: true,
      approver: true,
    },
  });
  if (!report) notFound();

  const reportData = await collectReportData(report.tourId);
  const customerView = sanitizeReportForCustomer(reportData);
  const isExternalGpsReport = report.reportSource === "EXTERNAL_GPS_REPORT" || customerView.route.length < 3;
  const actualStart = report.actualStartedAt ?? customerView.tour.startTime;
  const actualEnd = report.actualCompletedAt ?? customerView.tour.endTime;
  const manualDistributorName = reportSnapshotValue(report.reportSnapshot, "manualDistributorName");
  const customerNote = reportSnapshotValue(report.reportSnapshot, "customerNote");
  const reviewedAt = report.reviewedAt ?? report.approvedAt ?? report.publishedAt ?? report.generatedAt;
  const coverageLabel = customerView.coverage.actualCoveragePercent === null
    ? "Von FLYERO geprüft"
    : `${customerView.coverage.actualCoveragePercent} %`;

  await createAuditLog({ userId: session.id, action: "report.viewed", entityType: "Report", entityId: report.id });

  return (
    <CustomerPortalShell
      active="/customer/reports"
      eyebrow="FLYERO Verteilnachweis"
      title="Verteilbericht"
      description={`${customerReportName(report.reportNumber)} / ${customerOrderName(customerView.order.orderNumber)}`}
    >
      <section className="customerSuccessBanner">
        <strong>Verteilung abgeschlossen und geprüft.</strong>
        <span>Dieser Bericht zeigt die freigegebenen Nachweise zu Gebiet, Zeitraum, Flyer-Menge und GPS-Dokumentation.</span>
        {report.pdfUrl ? <a className="primaryButton" href={`/api/customer/reports/${report.id}/download`}>PDF herunterladen</a> : null}
      </section>

      <section className="customerDetailActions" aria-label="Berichtsaktionen">
        <Link className="secondaryButton" href="/customer/reports">Alle Berichte</Link>
        <form action={createComplaintTicket}>
          <input type="hidden" name="reportId" value={report.id} />
          <button className="secondaryButton" type="submit">Rückfrage stellen</button>
        </form>
        <StatusBadge tone="success">Von FLYERO geprüft</StatusBadge>
      </section>

      <section className="customerDigestGrid">
        <article>
          <span>Geplante Flyer</span>
          <strong>{customerView.quantities.planned.toLocaleString("de-DE")}</strong>
        </article>
        <article>
          <span>Dokumentiert verteilt</span>
          <strong>{customerView.quantities.delivered.toLocaleString("de-DE")}</strong>
        </article>
        <article>
          <span>Nachweisstatus</span>
          <strong>{coverageLabel}</strong>
        </article>
        <article>
          <span>GPS-Nachweis</span>
          <strong>{isExternalGpsReport ? "Verfügbar" : `${(customerView.tour.distanceMeters / 1000).toFixed(1)} km`}</strong>
        </article>
      </section>

      <div className="customerTwoColumn">
        <DataSection title="Verteilung" description="Die wichtigsten Angaben aus Planung und Durchführung.">
          <div className="customerFactList">
            <p><span>Kampagne</span><strong>{customerOrderName(customerView.order.orderNumber)}</strong></p>
            <p><span>Gebiet</span><strong>{customerAreaName(customerView.order.area)}</strong></p>
            <p><span>Ort</span><strong>{customerView.order.postalCode} {customerView.order.city}</strong></p>
            <p><span>Wunschzeitraum</span><strong>{formatDateTime(customerView.order.preferredStartDate)} bis {formatDateTime(customerView.order.preferredEndDate)}</strong></p>
            <p><span>Verteilt am</span><strong>{formatDateTime(actualStart)} bis {formatDateTime(actualEnd)}</strong></p>
            <p><span>Aktive Zustellzeit</span><strong>{secondsLabel(customerView.tour.activeSeconds)}</strong></p>
          </div>
        </DataSection>

        <DataSection title="Nachweise" description="Nur geprüfte und freigegebene Nachweise sind hier sichtbar.">
          <div className="customerProofBullets">
            <p><strong>GPS-Nachweis</strong><span>{isExternalGpsReport ? "GPS-Nachweis des eingesetzten Trackingsystems." : customerView.gpsQuality.customerStatus}</span></p>
            <p><strong>Foto-Dokumentation</strong><span>{customerView.photos.length} freigegebene Fotos.</span></p>
            <p><strong>PDF-Bericht</strong><span>{report.pdfUrl ? "Download bereit." : "Wird nach Freigabe erstellt."}</span></p>
            <p><strong>Ausführung</strong><span>{manualDistributorName ? `${manualDistributorName}, personenbezogene Daten geschützt.` : "FLYERO Verteilerteam, personenbezogene Daten geschützt."}</span></p>
          </div>
        </DataSection>
      </div>

      <DataSection title="Mengen und Ergebnis" description="Keine Briefkasten-Einzelgarantie, sondern ein geprüfter Nachweis der dokumentierten Durchführung.">
        <div className="customerFactList compact">
          <p><span>Geplant</span><strong>{customerView.quantities.planned.toLocaleString("de-DE")} Flyer</strong></p>
          <p><span>Dokumentiert verteilt</span><strong>{customerView.quantities.delivered.toLocaleString("de-DE")} Flyer</strong></p>
          <p><span>Restmenge</span><strong>{customerView.quantities.remaining.toLocaleString("de-DE")} Flyer</strong></p>
          <p><span>Berichtsgrundlage</span><strong>{isExternalGpsReport ? "Externer GPS-Bericht und manuelle Prüfung" : "Tourdaten, Fotos und Prüfung"}</strong></p>
        </div>
        {customerNote ? <p className="notice">{customerNote}</p> : null}
        <p className="muted">
          {isExternalGpsReport
            ? "Nachweis basiert auf externem GPS-Bericht und manueller Prüfung. Ohne eigene Tourpunkte wird keine automatische Flächenabdeckung behauptet."
            : "Der Abdeckungsgrad beschreibt die dokumentierte Verteilung anhand echter Tourdaten, freigegebener Fotos und interner Prüfung. Er ist kein Einzelbriefkasten-Nachweis."}
        </p>
      </DataSection>

      <DataSection title="GPS-Nachweis" description="Geplantes Gebiet und Nachweisquelle bleiben sauber getrennt.">
        {isExternalGpsReport ? (
          <div className="customerWarningBanner">
            <strong>GPS-Nachweis des eingesetzten Trackingsystems</strong>
            <span>Der Nachweis wurde extern erzeugt und von FLYERO geprüft. FLYERO stellt ihn als geprüften Nachweis des eingesetzten Systems bereit.</span>
          </div>
        ) : (
          <RouteMap
            points={customerView.route.map((point) => ({
              lat: point.lat,
              lng: point.lng,
              recordedAt: point.recordedAt.toISOString(),
            }))}
            photos={customerView.photos.map((photo, index) => ({
              lat: photo.lat,
              lng: photo.lng,
              label: `Foto ${index + 1}`,
            }))}
          />
        )}
      </DataSection>

      <DataSection title="Weitere Nachweise" description="Freigegebene Dateien können geschützt heruntergeladen werden.">
        <div className="customerMessageList">
          {report.order.documents.map((document) => (
            <article className="customerMessageItem" key={document.id}>
              <div className="customerItemHeader">
                <strong>{document.title}</strong>
                <span>{document.providerName || document.extension.toUpperCase()}</span>
              </div>
              <a className="secondaryButton" href={`/api/customer/reports/${report.id}/evidence/${document.id}`}>Nachweis herunterladen</a>
            </article>
          ))}
          {report.order.documents.length === 0 ? (
            <article className="customerMessageItem">
              <strong>Keine weiteren freigegebenen Nachweise vorhanden.</strong>
              <span>FLYERO zeigt hier nur Dateien, die intern geprüft und freigegeben wurden.</span>
            </article>
          ) : null}
        </div>
      </DataSection>

      <DataSection title="Foto-Nachweise" description="Fotos werden vor Veröffentlichung geprüft.">
        <div className="photoGrid">
          {customerView.photos.length > 0 ? customerView.photos.map((photo, index) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Bericht zeigt gespeicherte Fotonachweise. */}
              <img src={photo.url} alt={`Verteilnachweis ${index + 1}`} />
              <figcaption>{photo.caption || formatDateTime(photo.takenAt)} / Standort anonymisiert</figcaption>
            </figure>
          )) : <p className="muted">Für diesen Bericht wurden keine Kundenfotos freigegeben.</p>}
        </div>
      </DataSection>

      {customerView.deviations.length > 0 ? (
        <DataSection title="Hinweise zur Verteilung" description="Nur freigegebene, verständliche Hinweise sind sichtbar.">
          {customerView.deviations.map((deviation) => (
            <div className="notice" key={deviation.description}>
              <strong>{deviation.description}</strong>
              {deviation.resolution ? <p>{deviation.resolution}</p> : null}
            </div>
          ))}
        </DataSection>
      ) : null}

      <DataSection title="Prüfung" description="Der Bericht wurde intern geprüft, bevor er für Sie sichtbar wurde.">
        <div className="customerFactList compact">
          <p><span>Status</span><strong>Von FLYERO geprüft</strong></p>
          <p><span>Prüfdatum</span><strong>{formatDateTime(reviewedAt)}</strong></p>
          <p><span>PDF-Bericht</span><strong>{report.pdfUrl ? "Bereit" : "Wird erstellt"}</strong></p>
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
