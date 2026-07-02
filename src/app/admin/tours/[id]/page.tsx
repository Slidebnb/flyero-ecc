import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { RouteMap } from "@/app/components/RouteMap";
import { requireRole } from "@/lib/auth";
import { TOUR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { analyzeRoute, normalizeRoutePoint } from "@/lib/routeAnalysis";
import { openTourReview } from "@/lib/tours";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

function routePoint(point: { lat: unknown; lng: unknown; recordedAt: Date }) {
  return { lat: Number(point.lat?.toString()), lng: Number(point.lng?.toString()), recordedAt: point.recordedAt.toISOString() };
}

export default async function AdminTourDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.ADMIN]);
  const { id } = await params;
  const tour = await prisma.distributionTour.findUnique({
    where: { id },
    include: {
      distributor: { include: { user: true } },
      order: { include: { customer: true, statusEvents: { orderBy: { createdAt: "desc" } } } },
      inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
      gpsPoints: { orderBy: { recordedAt: "asc" } },
      photoProofs: { orderBy: { createdAt: "desc" } },
      reports: { orderBy: { updatedAt: "desc" }, take: 1 },
    },
  });
  if (!tour) notFound();
  const analysis = analyzeRoute({
    points: tour.gpsPoints.map(normalizeRoutePoint),
    pauseSeconds: tour.totalPauseSeconds,
    targetAreaGeoJson: tour.order.targetAreaGeoJson,
  });
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "DistributionTour", entityId: tour.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  await openTourReview({ tourId: tour.id, adminUserId: session.id });
  const latestReport = tour.reports[0] ?? null;

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Tourpruefung</p>
          <h1>{tour.order.orderNumber}</h1>
          <span className="badge">{TOUR_STATUS_LABELS[tour.status]}</span>
        </div>
        <nav className="nav">
          <Link href="/admin/tours">Alle Touren</Link>
          <Link href="/admin/dashboard">Dashboard</Link>
        </nav>
      </header>

      <section className="gridCards">
        <article className="card"><strong>{analysis.pointCount}</strong><span>GPS-Punkte</span></article>
        <article className="card"><strong>{tour.photoProofs.length}</strong><span>Fotos</span></article>
        <article className="card"><strong>{analysis.distanceMeters} m</strong><span>Strecke</span></article>
        <article className="card"><strong>{analysis.activeSeconds} s</strong><span>Aktive Zeit</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Pruefentscheidung</h2>
        <div className="reviewActions">
          <form action={`/api/admin/tours/${tour.id}/approve`} method="post" className="form">
            <textarea name="note" placeholder="Interne Freigabenotiz" />
            <textarea name="customerMessage" placeholder="Kundenhinweis optional" />
            <button type="submit">Tour freigeben</button>
          </form>
          <form action={`/api/admin/tours/${tour.id}/reject`} method="post" className="form">
            <textarea name="note" placeholder="Ablehnungsgrund intern" />
            <textarea name="customerMessage" placeholder="Kundenhinweis nur wenn gewuenscht" />
            <button type="submit">Tour ablehnen</button>
          </form>
          <form action={`/api/admin/tours/${tour.id}/clarify`} method="post" className="form">
            <textarea name="note" placeholder="Rueckfrage an Verteiler" />
            <button type="submit">Rueckfrage an Verteiler</button>
          </form>
        </div>
        <form action={`/api/admin/tours/${tour.id}/note`} method="post" className="form grid">
          <label>Interne Notiz<textarea name="adminInternalNote" defaultValue={tour.adminInternalNote ?? ""} /></label>
          <label>Kundenhinweis<textarea name="adminCustomerMessage" defaultValue={tour.adminCustomerMessage ?? ""} /></label>
          <button type="submit">Notizen speichern</button>
        </form>
      </section>

      {tour.status === "APPROVED" ? (
        <section className="panel stack widePanel" style={{ marginTop: 18 }}>
          <div className="splitHeader">
            <div>
              <p className="eyebrow">Kundenbericht</p>
              <h2 className="sectionTitle">Verteilbericht erzeugen</h2>
              <p className="muted">
                Nach der Tourfreigabe kann ein Online-Bericht mit PDF-Nachweis erzeugt,
                aktualisiert und fuer den Kunden veroeffentlicht werden.
              </p>
            </div>
            {latestReport ? <span className="badge">{latestReport.status}</span> : <span className="badge warning">Noch kein Bericht</span>}
          </div>
          {latestReport ? (
            <div className="tableWrap">
              <table>
                <tbody>
                  <tr><th>Bericht</th><td>{latestReport.reportNumber}</td></tr>
                  <tr><th>Version</th><td>{latestReport.version}</td></tr>
                  <tr><th>Online</th><td><Link className="textLink" href={`/admin/reports/${latestReport.id}`}>Admin-Detail oeffnen</Link></td></tr>
                  <tr><th>PDF</th><td>{latestReport.pdfUrl ? <a className="textLink" href={latestReport.pdfUrl}>PDF ansehen</a> : "Noch nicht erzeugt"}</td></tr>
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="actions">
            <form action={`/api/admin/tours/${tour.id}/generate-report`} method="post">
              <button type="submit">{latestReport ? "Bericht neu aufbauen" : "Bericht generieren"}</button>
            </form>
            {latestReport ? (
              <>
                <form action={`/api/admin/reports/${latestReport.id}/regenerate`} method="post">
                  <button type="submit">Neu generieren</button>
                </form>
                <form action={`/api/admin/reports/${latestReport.id}/publish`} method="post">
                  <button type="submit">Veroeffentlichen</button>
                </form>
                <form action={`/api/admin/reports/${latestReport.id}/archive`} method="post">
                  <button type="submit">Archivieren</button>
                </form>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Karte</h2>
        <RouteMap
          points={tour.gpsPoints.map(routePoint)}
          photos={tour.photoProofs.map((photo) => ({
            lat: photo.lat ? Number(photo.lat) : null,
            lng: photo.lng ? Number(photo.lng) : null,
            label: formatDateTime(photo.takenAt ?? photo.createdAt),
          }))}
        />
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Details</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{tour.order.customer.companyName}</td></tr>
              <tr><th>Verteiler</th><td>{tour.distributor.firstName} {tour.distributor.lastName} ({tour.distributor.user.email}, {tour.distributor.phone})</td></tr>
              <tr><th>Lagerbestand</th><td>{tour.inventory?.expectedFlyers ?? "-"} Flyer / Rest {tour.remainingFlyers ?? "-"}</td></tr>
              <tr><th>Lager</th><td>{tour.inventory?.warehouseLocation?.warehouse.name ?? "-"} / {tour.inventory?.warehouseLocation?.fullLabel ?? "-"}</td></tr>
              <tr><th>Start</th><td>{formatDateTime(analysis.startTime)}</td></tr>
              <tr><th>Ende</th><td>{formatDateTime(analysis.endTime)}</td></tr>
              <tr><th>Dauer</th><td>{analysis.totalDurationSeconds}s gesamt, {analysis.pauseSeconds}s Pause, {analysis.activeSeconds}s aktiv</td></tr>
              <tr><th>Geschwindigkeit</th><td>Durchschnitt {analysis.averageSpeedMps.toFixed(2)} m/s, max {analysis.maxSpeedMps.toFixed(2)} m/s</td></tr>
              <tr><th>Manipulationsflags</th><td>{analysis.flags.join(", ") || "-"}</td></tr>
              <tr><th>Verteiler-Notiz</th><td>{tour.distributorNotes || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">GPS-Punkte</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Zeit</th><th>Lat</th><th>Lng</th><th>Accuracy</th><th>Status</th><th>Flags</th></tr></thead>
            <tbody>
              {tour.gpsPoints.map((point) => (
                <tr key={point.id}>
                  <td>{formatDateTime(point.recordedAt)}</td>
                  <td>{point.lat.toString()}</td>
                  <td>{point.lng.toString()}</td>
                  <td>{point.accuracy?.toString() ?? "-"}</td>
                  <td>{point.status}</td>
                  <td>{JSON.stringify(point.flags ?? [])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Fotos</h2>
        <div className="photoGrid">
          {tour.photoProofs.map((photo) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- Foto-Nachweise koennen Data-URLs aus der PWA sein. */}
              <img src={photo.url} alt="Tourfoto" />
              <figcaption>{formatDateTime(photo.takenAt ?? photo.createdAt)} / {photo.lat?.toString() ?? "-"}, {photo.lng?.toString() ?? "-"}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">AuditLog und Statushistorie</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Zeit</th><th>Event</th><th>Werte</th></tr></thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td>{log.action}</td><td><pre>{JSON.stringify(log.newValues ?? log.oldValues ?? {}, null, 2)}</pre></td></tr>
              ))}
              {tour.order.statusEvents.map((event) => (
                <tr key={event.id}><td>{formatDateTime(event.createdAt)}</td><td>order.{event.toStatus}</td><td>{event.note ?? "-"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
