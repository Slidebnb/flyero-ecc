import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminReportsPage() {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const reports = await prisma.report.findMany({
    include: { order: { include: { customer: true } }, tour: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Berichte</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/tours">Touren</Link>
        </nav>
      </header>
      <section className="panel stack widePanel">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Bericht</th><th>Auftrag</th><th>Kunde</th><th>Status</th><th>PDF</th><th>Aktualisiert</th><th></th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reportNumber}</td>
                  <td>{report.order.orderNumber}</td>
                  <td>{report.order.customer.companyName}</td>
                  <td><span className="badge">{report.status}</span></td>
                  <td>{report.pdfUrl ? "Ja" : "Nein"}</td>
                  <td>{formatDateTime(report.updatedAt)}</td>
                  <td><Link className="textLink" href={`/admin/reports/${report.id}`}>Oeffnen</Link></td>
                </tr>
              ))}
              {reports.length === 0 ? <tr><td colSpan={7}>Noch keine Berichte.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
