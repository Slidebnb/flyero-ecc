import Link from "next/link";
import { DispatchAssignmentStatus, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { DISPATCH_STATUS_LABELS, TOUR_STATUS_LABELS } from "@/lib/constants";
import { getDispatchDashboard } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/format";

type PageProps = {
  searchParams: Promise<{
    city?: string;
    distributor?: string;
    status?: DispatchAssignmentStatus;
    date?: string;
    warehouse?: string;
  }>;
};

function warningText(value: boolean) {
  return value ? "Kapazitaet ueberschritten" : "Kapazitaet ok";
}

export default async function AdminDispatchPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const filters = await searchParams;
  const dashboard = await getDispatchDashboard(filters);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Disposition</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/orders">Auftraege</Link>
          <Link href="/admin/tours">Touren</Link>
          <Link href="/admin/warehouse">Lager</Link>
        </nav>
      </header>

      <section className="gridCards">
        <article className="card"><strong>{dashboard.metrics.openOrders}</strong><span>Offene Auftraege</span></article>
        <article className="card"><strong>{dashboard.metrics.unassigned}</strong><span>Nicht zugewiesen</span></article>
        <article className="card"><strong>{dashboard.metrics.reserved}</strong><span>Reserviert</span></article>
        <article className="card"><strong>{dashboard.metrics.readyForPickup}</strong><span>Abholbereit</span></article>
        <article className="card"><strong>{dashboard.metrics.plannedToday}</strong><span>Heute geplant</span></article>
        <article className="card"><strong>{dashboard.metrics.completedToday}</strong><span>Heute erledigt</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Filter</h2>
        <form className="form grid" action="/admin/dispatch" method="get">
          <label>
            Stadt
            <input name="city" defaultValue={filters.city ?? ""} />
          </label>
          <label>
            Verteiler
            <select name="distributor" defaultValue={filters.distributor ?? ""}>
              <option value="">Alle Verteiler</option>
              {dashboard.distributors.map((distributor) => (
                <option key={distributor.id} value={distributor.id}>
                  {distributor.firstName} {distributor.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Alle Status</option>
              {Object.entries(DISPATCH_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Datum
            <input name="date" type="date" defaultValue={filters.date ?? ""} />
          </label>
          <label>
            Lager
            <select name="warehouse" defaultValue={filters.warehouse ?? ""}>
              <option value="">Alle Lager</option>
              {dashboard.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Nicht zugewiesene Auftraege</h2>
        {dashboard.unassignedInventories.map((inventory) => {
          const recommendations = dashboard.recommendationsByOrderId[inventory.orderId] ?? [];
          return (
            <article className="stack" key={inventory.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
              <div className="splitHeader">
                <div>
                  <strong>{inventory.order.orderNumber}</strong>
                  <p className="muted">
                    {inventory.order.customer.companyName} / {inventory.order.city} / {inventory.expectedFlyers} Flyer / {inventory.warehouseLocation?.warehouse.name ?? "Lager"}
                  </p>
                </div>
                <Link className="textLink" href={`/admin/orders/${inventory.orderId}`}>Auftrag oeffnen</Link>
              </div>
              <div className="inlineActions">
                <form action={`/api/admin/dispatch/recommend/${inventory.orderId}`} method="post">
                  <button type="submit">Empfehlungen erstellen</button>
                </form>
                <form action={`/api/admin/dispatch/auto-assign/${inventory.orderId}`} method="post">
                  <button type="submit">Auto-Assign versuchen</button>
                </form>
              </div>
              {dashboard.persistedRecommendations.filter((item) => item.orderId === inventory.orderId).length > 0 ? (
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Top Empfehlung</th><th>Score</th><th>Gruende</th><th>Warnungen</th><th>Aktionen</th></tr></thead>
                    <tbody>
                      {dashboard.persistedRecommendations.filter((item) => item.orderId === inventory.orderId).slice(0, 5).map((item) => (
                        <tr key={item.id}>
                          <td>{item.distributor.firstName} {item.distributor.lastName}</td>
                          <td><strong>{item.score}</strong>/100</td>
                          <td>{Array.isArray(item.reasons) ? item.reasons.join(", ") : "-"}</td>
                          <td>{Array.isArray(item.warnings) && item.warnings.length ? item.warnings.join(", ") : "-"}</td>
                          <td>
                            <div className="inlineActions">
                              <form action={`/api/admin/orders/${inventory.orderId}/assign`} method="post">
                                <input type="hidden" name="distributorId" value={item.distributorId} />
                                <button type="submit">Empfohlenen Verteiler zuweisen</button>
                              </form>
                              <form action={`/api/admin/dispatch/recommendations/${item.id}/dismiss`} method="post">
                                <button type="submit">Empfehlung ignorieren</button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Verteiler</th>
                      <th>Score</th>
                      <th>Gruende</th>
                      <th>Warnungen</th>
                      <th>Stadt</th>
                      <th>Distanz</th>
                      <th>Offene Touren</th>
                      <th>Kapazitaet</th>
                      <th>Rating</th>
                      <th>Erledigt</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recommendations.map((recommendation) => (
                      <tr key={recommendation.distributorId}>
                        <td>{recommendation.name}</td>
                        <td><strong>{recommendation.score}</strong>/100</td>
                        <td>{recommendation.reasons.join(", ")}</td>
                        <td>{recommendation.warnings.length ? recommendation.warnings.join(", ") : "-"}</td>
                        <td>{recommendation.city || "-"}</td>
                        <td>{recommendation.distanceKm.toFixed(0)} km</td>
                        <td>{recommendation.openTours}</td>
                        <td>
                          <span className={recommendation.capacityWarning ? "badge warning" : "badge success"}>
                            {warningText(recommendation.capacityWarning)}
                          </span>
                          <br />
                          <small>
                            {recommendation.currentAssignedTours}/{recommendation.maxToursPerDay} Touren,
                            {" "}{recommendation.currentAssignedFlyers}/{recommendation.maxFlyersPerDay} Flyer
                          </small>
                        </td>
                        <td>{recommendation.rating.toFixed(1)}</td>
                        <td>{recommendation.completedTours}</td>
                        <td>
                          <form action={`/api/admin/orders/${inventory.orderId}/assign`} method="post">
                            <input type="hidden" name="distributorId" value={recommendation.distributorId} />
                            <button type="submit">Zuweisen</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {recommendations.length === 0 ? (
                      <tr><td colSpan={11}>Keine passenden Verteiler gefunden.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
        {dashboard.unassignedInventories.length === 0 ? <p className="muted">Aktuell gibt es keine offenen Dispatch-Auftraege.</p> : null}
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Zugewiesene Auftraege</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Auftrag</th><th>Verteiler</th><th>Status</th><th>Lager</th><th>Kapazitaet</th><th>Aktualisiert</th></tr>
            </thead>
            <tbody>
              {dashboard.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.order.orderNumber}</td>
                  <td>{assignment.distributor.firstName} {assignment.distributor.lastName}</td>
                  <td>{DISPATCH_STATUS_LABELS[assignment.status]}</td>
                  <td>{assignment.inventory?.warehouseLocation?.warehouse.name ?? "-"}</td>
                  <td>{assignment.capacityWarning ? "Kapazitaet ueberschritten" : "OK"}</td>
                  <td>{formatDateTime(assignment.updatedAt)}</td>
                </tr>
              ))}
              {dashboard.assignments.length === 0 ? <tr><td colSpan={6}>Keine Zuweisungen vorhanden.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gridTwo" style={{ marginTop: 18 }}>
        <article className="panel stack">
          <h2 className="sectionTitle">Laufende Touren</h2>
          {dashboard.runningTours.map((tour) => (
            <p key={tour.id}>
              <strong>{tour.order.orderNumber}</strong><br />
              <span className="muted">{tour.distributor.firstName} {tour.distributor.lastName} / {TOUR_STATUS_LABELS[tour.status]}</span>
            </p>
          ))}
          {dashboard.runningTours.length === 0 ? <p className="muted">Keine laufenden Touren.</p> : null}
        </article>
        <article className="panel stack">
          <h2 className="sectionTitle">Abgeschlossene Touren</h2>
          {dashboard.completedTours.map((tour) => (
            <p key={tour.id}>
              <strong>{tour.order.orderNumber}</strong><br />
              <span className="muted">{tour.distributor.firstName} {tour.distributor.lastName} / {TOUR_STATUS_LABELS[tour.status]}</span>
            </p>
          ))}
          {dashboard.completedTours.length === 0 ? <p className="muted">Keine abgeschlossenen Touren.</p> : null}
        </article>
      </section>
    </main>
  );
}
