import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { RouteMap } from "@/app/components/RouteMap";
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
  const report = await prisma.report.findFirst({
    where: { id: reportId, customer: { userId: session.id } },
    select: { reportNumber: true, orderId: true, tourId: true },
  });
  if (!report) notFound();
  const ticket = await createTicket(session, {
    type: TicketType.COMPLAINT,
    priority: TicketPriority.HIGH,
    subject: `Problem zu Bericht ${report.reportNumber}`,
    description: "Kunde hat im Verteilbericht ein Problem gemeldet. Bitte Bericht, Tourdaten, GPS-Prüfung und Fotodokumentation prüfen.",
    reportId,
    orderId: report.orderId,
    tourId: report.tourId,
  });
  redirect(`/customer/support/tickets/${ticket.id}`);
}

export default async function CustomerReportDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const report = await prisma.report.findFirst({
    where: {
      id,
      status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] },
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
    <main className="appShell reportShell">
      <header className="reportHero">
        <div>
          <p className="eyebrow">Flyero Verteilnachweis</p>
          <h1>Verteilbericht</h1>
          <p className="lead">{report.reportNumber} / Auftrag {customerView.order.orderNumber}</p>
        </div>
        <div className="reportSeal">
          <strong>{customerView.gpsQuality.label}</strong>
          <span>GPS-Qualitaet {customerView.gpsQuality.score}/100</span>
        </div>
      </header>

      <nav className="nav" style={{ marginBottom: 18 }}>
        <Link href="/customer/reports">Alle Berichte</Link>
        {report.pdfUrl ? <a href={`/api/customer/reports/${report.id}/download`}>PDF herunterladen</a> : null}
        <form action={createComplaintTicket}>
          <input type="hidden" name="reportId" value={report.id} />
          <button type="submit">Problem melden</button>
        </form>
        <Link href="/customer/dashboard">Dashboard</Link>
      </nav>

      <section className="gridCards">
        <article className="card"><strong>{customerView.order.flyerQuantity}</strong><span>Flyer</span></article>
        <article className="card"><strong>{customerView.order.estimatedHouseholds ?? "-"}</strong><span>Haushalte</span></article>
        <article className="card"><strong>{(customerView.tour.distanceMeters / 1000).toFixed(1)} km</strong><span>Strecke</span></article>
        <article className="card"><strong>{secondsLabel(customerView.tour.activeSeconds)}</strong><span>Aktive Zeit</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Zusammenfassung</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{customerView.order.customerCompany}</td></tr>
              <tr><th>Gebiet</th><td>{customerView.order.area}</td></tr>
              <tr><th>Stadt/PLZ</th><td>{customerView.order.city} {customerView.order.postalCode}</td></tr>
              <tr><th>Zeitraum</th><td>{formatDateTime(customerView.order.preferredStartDate)} bis {formatDateTime(customerView.order.preferredEndDate)}</td></tr>
              <tr><th>Startzeit</th><td>{formatDateTime(customerView.tour.startTime)}</td></tr>
              <tr><th>Endzeit</th><td>{formatDateTime(customerView.tour.endTime)}</td></tr>
              <tr><th>Dauer</th><td>{secondsLabel(customerView.tour.durationSeconds)}</td></tr>
              <tr><th>Restflyer</th><td>{customerView.tour.remainingFlyers ?? 0}</td></tr>
              <tr><th>Verteiler</th><td>{customerView.tour.distributor}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Karte mit Route</h2>
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
        <h2 className="sectionTitle">Fotodokumentation</h2>
        <div className="photoGrid">
          {customerView.photos.map((photo, index) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Bericht zeigt gespeicherte PWA-Fotonachweise. */}
              <img src={photo.url} alt={`Verteilnachweis ${index + 1}`} />
              <figcaption>{formatDateTime(photo.takenAt)} / Standort anonymisiert</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Pruefung</h2>
        <div className="notice">
          <strong>Adminfreigabe dokumentiert</strong>
          <p>Pruefdatum: {formatDateTime(report.approvedAt ?? report.generatedAt)}</p>
          <p>Digitale Pruefnummer: {report.verificationCode}</p>
          <p>Digitale Kennung: {report.checksum ?? "-"}</p>
          <p>Bericht-ID: {report.id}</p>
        </div>
      </section>
    </main>
  );
}
