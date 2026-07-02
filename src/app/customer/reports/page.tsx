import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerReportsPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const reports = await prisma.report.findMany({
    where: { status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] }, order: { customer: { userId: session.id } }, tour: { status: "APPROVED" } },
    include: { order: true, tour: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Verteilberichte</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/dashboard">Dashboard</Link>
          <Link href="/customer/orders">Meine Auftraege</Link>
        </nav>
      </header>
      <section className="panel stack widePanel">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Bericht</th><th>Auftrag</th><th>Status</th><th>Gebiet</th><th>PDF</th><th></th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reportNumber}</td>
                  <td>{report.order.orderNumber}</td>
                  <td><span className="badge success">{report.status}</span></td>
                  <td>{report.order.targetAreaName}</td>
                  <td>{report.pdfUrl ? <a className="textLink" href={`/api/customer/reports/${report.id}/download`}>Download</a> : "-"}</td>
                  <td><Link className="textLink" href={`/customer/reports/${report.id}`}>Ansehen</Link></td>
                </tr>
              ))}
              {reports.length === 0 ? <tr><td colSpan={6}>Noch keine Verteilberichte verfuegbar.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <p className="muted">Zuletzt aktualisiert: {formatDateTime(reports[0]?.updatedAt)}</p>
      </section>
    </main>
  );
}
