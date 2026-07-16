import Link from "next/link";
import { DispatchAssignmentStatus, UserRole } from "@prisma/client";
import { EmptyState } from "@/app/PortalComponents";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { requireRole } from "@/lib/auth";
import { DISPATCH_STATUS_LABELS, TOUR_STATUS_LABELS } from "@/lib/constants";
import { getDispatchDashboard } from "@/lib/dispatch";
import { formatDateTime } from "@/lib/format";
import { combineOrders } from "@/lib/routing";

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
  return value ? "Kapazität überschritten" : "Kapazität ok";
}

export default async function AdminDispatchPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const filters = await searchParams;
  const [dashboard, combinations] = await Promise.all([
    getDispatchDashboard(filters, session.role === UserRole.ADMIN ? undefined : session.tenantId),
    combineOrders({ city: filters.city, postalCode: undefined, tenantId: session.role === UserRole.ADMIN ? undefined : session.tenantId }),
  ]);

  return (
    <AdminPortalShell
      title="Disposition"
      description="Offene Aufträge, Verteilerempfehlungen, Tour-Kombinationen und laufende Zustellungen koordinieren."
    >
      <section className="gridCards">
        <article className="card"><strong>{dashboard.metrics.openOrders}</strong><span>Offene Aufträge</span></article>
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
        <h2 className="sectionTitle">Nicht zugewiesene Aufträge</h2>
        {dashboard.unassignedInventories.map((inventory) => {
          const isMultiSegmentOrder = inventory.order.distributionSegments.length > 1;
          const recommendations = isMultiSegmentOrder ? [] : dashboard.recommendationsByOrderId[inventory.orderId] ?? [];
          return (
            <article className="stack" key={inventory.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 18 }}>
              <div className="splitHeader">
                <div>
                  <strong>{inventory.order.orderNumber}</strong>
                  <p className="muted">
                    {inventory.order.customer.companyName} / {inventory.order.city} / {inventory.expectedFlyers} Flyer / {inventory.warehouseLocation?.warehouse.name ?? "Lager"}
                  </p>
                </div>
                <Link className="textLink" href={`/admin/orders/${inventory.orderId}`}>Auftrag öffnen</Link>
              </div>
              <div className="inlineActions">
                <form action={`/api/admin/dispatch/recommend/${inventory.orderId}`} method="post">
                  {isMultiSegmentOrder ? (
                    <select name="segmentId" required defaultValue="">
                      <option value="" disabled>Teilgebiet auswählen</option>
                      {inventory.order.distributionSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.flyerQuantity ?? inventory.expectedFlyers} Flyer)</option>)}
                    </select>
                  ) : null}
                  <button type="submit">Empfehlungen erstellen</button>
                </form>
                <form action={`/api/admin/dispatch/auto-assign/${inventory.orderId}`} method="post">
                  {isMultiSegmentOrder ? (
                    <select name="segmentId" required defaultValue="">
                      <option value="" disabled>Teilgebiet auswählen</option>
                      {inventory.order.distributionSegments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({segment.flyerQuantity ?? inventory.expectedFlyers} Flyer)</option>)}
                    </select>
                  ) : null}
                  <button type="submit">Auto-Zuweisung prüfen</button>
                </form>
              </div>
              {isMultiSegmentOrder ? <p className="muted">Dieser Auftrag wird je Teilgebiet disponiert. Wähle zuerst ein Teilgebiet, damit Kapazität und Empfehlungen mit dessen Flyerzahl berechnet werden.</p> : null}
              {dashboard.persistedRecommendations.filter((item) => item.orderId === inventory.orderId).length > 0 ? (
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Top Empfehlung</th><th>Score</th><th>Gründe</th><th>Warnungen</th><th>Aktionen</th></tr></thead>
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
                                {item.segmentId ? <input type="hidden" name="segmentId" value={item.segmentId} /> : null}
                                <input type="hidden" name="returnTo" value="/admin/dispatch?assignment=success" />
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
                      <th>Gründe</th>
                      <th>Warnungen</th>
                      <th>Stadt</th>
                      <th>Distanz</th>
                      <th>Offene Touren</th>
                      <th>Kapazität</th>
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
                        <td>{recommendation.distanceKm == null ? "Nicht ermittelt" : <>ca. {recommendation.distanceKm.toFixed(0)} km<br /><small>aus Koordinaten berechnet</small></>}</td>
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
                            {isMultiSegmentOrder ? <input type="hidden" name="segmentId" value={inventory.order.distributionSegments[0]?.id} /> : null}
                            <input type="hidden" name="returnTo" value="/admin/dispatch?assignment=success" />
                            <button type="submit">Zuweisen</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {recommendations.length === 0 ? (
                      <tr>
                        <td colSpan={11}>
                          <EmptyState
                            title="Keine passenden Verteiler gefunden."
                            description="Passe Stadt, Lager oder Verfügbarkeit an und erstelle danach neue Empfehlungen."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          );
        })}
        {dashboard.unassignedInventories.length === 0 ? (
          <EmptyState
            title="Keine offenen Dispatch-Aufträge."
            description="Sobald ein Auftrag abholbereit ist, erscheint er hier zur Verteilerzuweisung."
          />
        ) : null}
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <div className="splitHeader">
          <div>
            <h2 className="sectionTitle">Tour-Kombinationen</h2>
            <p className="muted">Automatische Vorschläge, wenn mehrere Kunden im gleichen Gebiet gebucht haben.</p>
          </div>
          <Link className="textLink" href="/api/admin/dispatch/combinations">API öffnen</Link>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Gebiet</th><th>Aufträge</th><th>Flyer</th><th>Strecke sparen</th><th>Zeit sparen</th><th>Kosten sparen</th></tr>
            </thead>
            <tbody>
              {combinations.slice(0, 8).map((combination) => (
                <tr key={combination.key}>
                  <td>{combination.postalCodePrefix} {combination.city}</td>
                  <td>{combination.orders.length}</td>
                  <td>{combination.totalFlyers}</td>
                  <td>{(combination.savedDistanceMeters / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km</td>
                  <td>{combination.savedMinutes} min</td>
                  <td>{combination.savedCostEstimate} €</td>
                </tr>
              ))}
              {combinations.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Noch keine sinnvollen Kombinationen gefunden."
                      description="Kombinationen entstehen, wenn mehrere Aufträge räumlich und zeitlich zusammenpassen."
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Zugewiesene Aufträge</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Auftrag</th><th>Verteiler</th><th>Status</th><th>Lager</th><th>Kapazität</th><th>Aktualisiert</th></tr>
            </thead>
            <tbody>
              {dashboard.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.order.orderNumber}</td>
                  <td>{assignment.distributor.firstName} {assignment.distributor.lastName}</td>
                  <td>{DISPATCH_STATUS_LABELS[assignment.status]}</td>
                  <td>{assignment.inventory?.warehouseLocation?.warehouse.name ?? "-"}</td>
                  <td>{assignment.capacityWarning ? "Kapazität überschritten" : "OK"}</td>
                  <td>{formatDateTime(assignment.updatedAt)}</td>
                </tr>
              ))}
              {dashboard.assignments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Keine Zuweisungen vorhanden."
                      description="Zuweisungen erscheinen hier, nachdem ein Auftrag einem Verteiler zugeordnet wurde."
                    />
                  </td>
                </tr>
              ) : null}
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
          {dashboard.runningTours.length === 0 ? (
            <EmptyState title="Keine laufenden Touren." description="Aktive Touren erscheinen hier in Echtzeit." />
          ) : null}
        </article>
        <article className="panel stack">
          <h2 className="sectionTitle">Abgeschlossene Touren</h2>
          {dashboard.completedTours.map((tour) => (
            <p key={tour.id}>
              <strong>{tour.order.orderNumber}</strong><br />
              <span className="muted">{tour.distributor.firstName} {tour.distributor.lastName} / {TOUR_STATUS_LABELS[tour.status]}</span>
            </p>
          ))}
          {dashboard.completedTours.length === 0 ? (
            <EmptyState title="Keine abgeschlossenen Touren." description="Freigegebene Tourabschlüsse werden hier chronologisch sichtbar." />
          ) : null}
        </article>
      </section>
    </AdminPortalShell>
  );
}
