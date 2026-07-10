import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { RouteMap } from "@/app/components/RouteMap";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { collectReportData } from "@/lib/reports";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminReportDetailPage({ params }: PageProps) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: { order: { include: { customer: true } }, tour: true, approver: true },
  });
  if (!report) notFound();
  const data = await collectReportData(report.tourId);
  const visiblePhotos = data.tour.photoProofs.filter((photo) => photo.customerVisible && photo.reviewStatus === "APPROVED");
  const deviations = await prisma.distributionDeviation.findMany({ where: { orderId: report.orderId }, orderBy: { createdAt: "asc" } });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbericht</p>
          <h1>{report.reportNumber}</h1>
          <span className="badge">{report.status}</span>
        </div>
        <nav className="nav">
          <Link href="/admin/reports">Alle Berichte</Link>
          <Link href={`/admin/tours/${report.tourId}`}>Tour</Link>
        </nav>
      </header>

      <section className="gridCards">
        <article className="card"><strong>{data.qualityScore}</strong><span>GPS-Score</span></article>
        <article className="card"><strong>{data.analysis.flags.length}</strong><span>Admin-Flags</span></article>
        <article className="card"><strong>{visiblePhotos.length}/{data.tour.photoProofs.length}</strong><span>Foto-Freigaben</span></article>
        <article className="card"><strong>{report.reportVersion}</strong><span>Version</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Aktionen</h2>
        <div className="actions">
          <form action={`/api/admin/reports/${report.id}/regenerate`} method="post"><button type="submit">Bericht neu generieren</button></form>
          <form action={`/api/admin/reports/${report.id}/approve`} method="post"><button type="submit">Intern freigeben</button></form>
          <form action={`/api/admin/reports/${report.id}/publish`} method="post"><button type="submit">Bericht veröffentlichen</button></form>
          <form action={`/api/admin/reports/${report.id}/request-correction`} method="post"><button type="submit">Korrektur anfordern</button></form>
          <form action={`/api/admin/reports/${report.id}/archive`} method="post"><button type="submit">Bericht archivieren</button></form>
          {report.pdfUrl ? <a href={`/api/admin/reports/${report.id}/download`}>PDF ansehen</a> : null}
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Prüfstatus</h2>
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Kunde</th><td>{report.order.customer.companyName}</td></tr>
              <tr><th>Auftrag</th><td>{report.order.orderNumber}</td></tr>
              <tr><th>Gebiet</th><td>{report.order.targetAreaName}</td></tr>
              <tr><th>Interne Prüfung</th><td>{report.internalReviewStatus}</td></tr>
              <tr><th>Generiert</th><td>{formatDateTime(report.generatedAt)}</td></tr>
              <tr><th>Geprueft</th><td>{formatDateTime(report.reviewedAt ?? report.approvedAt)}</td></tr>
              <tr><th>Veröffentlicht</th><td>{formatDateTime(report.publishedAt)}</td></tr>
              <tr><th>Prüfcode</th><td>{report.verificationCode}</td></tr>
              <tr><th>Checksum</th><td>{report.checksum ?? "-"}</td></tr>
              <tr><th>Admin-Flags</th><td>{data.analysis.flags.join(", ") || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Abweichungen</h2>
        {deviations.length > 0 ? deviations.map((deviation) => (
          <div className="notice" key={deviation.id}>
            <strong>{deviation.type} / {deviation.severity}</strong>
            <p>{deviation.description}</p>
            <p>Kundensichtbar: {deviation.customerVisible ? "ja" : "nein"}</p>
          </div>
        )) : <p className="muted">Keine Abweichungen dokumentiert.</p>}
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Karte</h2>
        <RouteMap
          points={data.tour.gpsPoints.map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
            recordedAt: point.recordedAt.toISOString(),
          }))}
          photos={data.tour.photoProofs.map((photo) => ({
            lat: photo.lat ? Number(photo.lat) : null,
            lng: photo.lng ? Number(photo.lng) : null,
            label: `${photo.reviewStatus} / ${formatDateTime(photo.takenAt ?? photo.createdAt)}`,
          }))}
        />
      </section>
    </main>
  );
}
