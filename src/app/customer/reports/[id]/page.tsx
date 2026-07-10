import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { RouteMap } from "@/app/components/RouteMap";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { collectReportData, sanitizeReportForCustomer } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { createTicket } from "@/lib/support";

type PageProps = { params: Promise<{ id: string }> };

function secondsLabel(seconds?: number | null) {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} Min.`;
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
    description: "Kunde hat im Verteilbericht ein Problem gemeldet. Bitte Bericht, Tourdaten, GPS-Pruefung und Fotodokumentation pruefen.",
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
    include: { order: true, tour: true, approver: true },
  });
  if (!report) notFound();

  const reportData = await collectReportData(report.tourId);
  const customerView = sanitizeReportForCustomer(reportData);
  await createAuditLog({ userId: session.id, action: "report.viewed", entityType: "Report", entityId: report.id });

  return (
    <CustomerPortalShell
      active="/customer/reports"
      eyebrow="FLYERO Verteilnachweis"
      title="Verteilbericht"
      description={`${customerReportName(report.reportNumber)} / ${customerOrderName(customerView.order.orderNumber)}`}
    >
      <div className="customerActionRow">
        <Link className="secondaryButton" href="/customer/reports">Alle Berichte</Link>
        {report.pdfUrl ? <a className="primaryButton" href={`/api/customer/reports/${report.id}/download`}>PDF herunterladen</a> : null}
        <form action={createComplaintTicket}>
          <input type="hidden" name="reportId" value={report.id} />
          <button type="submit">Rueckfrage stellen</button>
        </form>
        <span className="statusBadge success">{customerView.gpsQuality.customerStatus}</span>
      </div>

      <section className="gridCards">
        <article className="card"><strong>{customerView.quantities.planned}</strong><span>Geplante Flyer</span></article>
        <article className="card"><strong>{customerView.quantities.delivered}</strong><span>Tatsaechlich dokumentiert</span></article>
        <article className="card"><strong>{customerView.coverage.actualCoveragePercent} %</strong><span>Dokumentierter Abdeckungsgrad</span></article>
        <article className="card"><strong>{(customerView.tour.distanceMeters / 1000).toFixed(1)} km</strong><span>GPS-Strecke</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Geplant und tatsaechlich dokumentiert</h2>
        <p className="muted">Hier sehen Sie, wann, wo und mit welchen Nachweisen verteilt wurde.</p>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kampagne</th><td>{customerOrderName(customerView.order.orderNumber)}</td></tr>
              <tr><th>Gebiet</th><td>{customerView.order.area}</td></tr>
              <tr><th>Stadt/PLZ</th><td>{customerView.order.city} {customerView.order.postalCode}</td></tr>
              <tr><th>Zeitraum</th><td>{formatDateTime(customerView.order.preferredStartDate)} bis {formatDateTime(customerView.order.preferredEndDate)}</td></tr>
              <tr><th>Tour gestartet</th><td>{formatDateTime(customerView.tour.startTime)}</td></tr>
              <tr><th>Tour beendet</th><td>{formatDateTime(customerView.tour.endTime)}</td></tr>
              <tr><th>Aktive Zustellzeit</th><td>{secondsLabel(customerView.tour.activeSeconds)}</td></tr>
              <tr><th>Geplant</th><td>{customerView.quantities.planned} Flyer</td></tr>
              <tr><th>Dokumentiert verteilt</th><td>{customerView.quantities.delivered} Flyer</td></tr>
              <tr><th>Restmenge</th><td>{customerView.quantities.remaining}</td></tr>
              <tr><th>Ausfuehrung</th><td>FLYERO Verteilerteam, personenbezogene Daten geschuetzt</td></tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          Der Abdeckungsgrad beschreibt die dokumentierte Verteilung anhand echter Tourdaten, freigegebener Fotos und interner Pruefung.
          Er ist kein Einzelbriefkasten-Nachweis.
        </p>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">GPS-Nachweis</h2>
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
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Foto-Nachweise</h2>
        <div className="photoGrid">
          {customerView.photos.length > 0 ? customerView.photos.map((photo, index) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Bericht zeigt gespeicherte PWA-Fotonachweise. */}
              <img src={photo.url} alt={`Verteilnachweis ${index + 1}`} />
              <figcaption>{photo.caption || formatDateTime(photo.takenAt)} / Standort anonymisiert</figcaption>
            </figure>
          )) : <p className="muted">Fuer diesen Bericht wurden keine Kundenfotos freigegeben.</p>}
        </div>
      </section>

      {customerView.deviations.length > 0 ? (
        <section className="panel stack widePanel" style={{ marginTop: 18 }}>
          <h2 className="sectionTitle">Hinweise zur Verteilung</h2>
          {customerView.deviations.map((deviation) => (
            <div className="notice" key={deviation.description}>
              <strong>{deviation.description}</strong>
              {deviation.resolution ? <p>{deviation.resolution}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Pruefung</h2>
        <div className="notice">
          <strong>Von FLYERO geprueft</strong>
          <p>Pruefdatum: {formatDateTime(report.publishedAt ?? report.approvedAt ?? report.generatedAt)}</p>
          <p>Pruefcode: {report.verificationCode}</p>
          <p>PDF-Bericht: {report.pdfUrl ? "bereit" : "wird erstellt"}</p>
        </div>
      </section>
    </CustomerPortalShell>
  );
}
