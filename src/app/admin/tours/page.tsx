import Link from "next/link";
import { UserRole } from "@prisma/client";
import { EmptyState } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { TOUR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminToursPage() {
  await requireRole([UserRole.ADMIN]);

  const [tours, inventories, distributors] = await Promise.all([
    prisma.distributionTour.findMany({
      include: {
        distributor: true,
        order: { include: { customer: true } },
        gpsPoints: true,
        photoProofs: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.warehouseInventory.findMany({
      where: { status: "READY_FOR_PICKUP" },
      include: { order: { include: { customer: true } }, warehouseLocation: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.distributorProfile.findMany({
      where: { reviewStatus: "APPROVED" },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Touren</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/warehouse">Lager</Link>
          <Link href="/admin/orders">Aufträge</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Tour zuweisen</h2>
        {inventories.length === 0 || distributors.length === 0 ? (
          <div className="notice">
            {inventories.length === 0
              ? "Es gibt aktuell keinen abholbereiten Lagerbestand. Prüfe Lagerstatus und Wareneingang."
              : "Es gibt aktuell keinen freigegebenen Verteiler. Prüfe die Verteilerfreigaben."}
          </div>
        ) : null}
        <form className="form grid" action="/api/admin/tours" method="post">
          <label>
            Abholbereiter Bestand
            <select name="inventoryId" required>
              {inventories.map((inventory) => (
                <option key={inventory.id} value={inventory.id}>
                  {inventory.order.orderNumber} - {inventory.order.customer.companyName} - {inventory.warehouseLocation?.fullLabel ?? "-"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Verteiler
            <select name="distributorId" required>
              {distributors.map((distributor) => (
                <option key={distributor.id} value={distributor.id}>
                  {distributor.firstName} {distributor.lastName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={inventories.length === 0 || distributors.length === 0}>Tour zuweisen</button>
        </form>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Tourenliste</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Auftrag</th><th>Verteiler</th><th>Status</th><th>Start</th><th>Ende</th><th>GPS</th><th>Fotos</th><th>Flags</th><th></th></tr>
            </thead>
            <tbody>
              {tours.map((tour) => (
                <tr key={tour.id}>
                  <td>{tour.order.orderNumber}</td>
                  <td>{tour.distributor.firstName} {tour.distributor.lastName}</td>
                  <td>{TOUR_STATUS_LABELS[tour.status]}</td>
                  <td>{formatDateTime(tour.startTime ?? tour.startedAt)}</td>
                  <td>{formatDateTime(tour.endTime ?? tour.completedAt)}</td>
                  <td>{tour.gpsPoints.length}</td>
                  <td>{tour.photoProofs.length}</td>
                  <td>{tour.fraudFlags ? "Ja" : "Nein"}</td>
                  <td><Link className="textLink" href={`/admin/tours/${tour.id}`}>Prüfen</Link></td>
                </tr>
              ))}
              {tours.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="Keine Touren vorhanden."
                      description="Touren entstehen, sobald ein abholbereiter Lagerbestand einem freigegebenen Verteiler zugewiesen wird."
                      action={{ href: "/admin/dispatch", label: "Dispatch öffnen" }}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
