import Link from "next/link";
import { UserRole } from "@prisma/client";
import {
  getAnalyticsFilterOptions,
  getBusinessOverview,
  parseAnalyticsFilters,
} from "@/lib/analytics";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { formatCurrency } from "@/lib/format";
import { getHeatmapData, getOrderExperienceAnalytics } from "@/lib/smartMaps";
import { ActionPanel, DataSection, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";

type PageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    city?: string;
    customerId?: string;
    distributorId?: string;
    status?: string;
  }>;
};

function dateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function queryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
}

function number(value: number, suffix = "") {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function BarChart({ title, points, currency = false }: { title: string; points: Array<{ key: string; label: string; value: number }>; currency?: boolean }) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <section className="analyticsChart">
      <h3>{title}</h3>
      <div className="barChart">
        {points.map((point) => (
          <div className="barRow" key={point.key}>
            <span>{point.label}</span>
            <div aria-hidden="true"><i style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }} /></div>
            <strong>{currency ? formatCurrency(point.value) : number(point.value)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusChart({ title, points }: { title: string; points: Array<{ key: string; label: string; value: number }> }) {
  const visible = points.filter((point) => point.value > 0).slice(0, 12);
  return (
    <section className="analyticsChart">
      <h3>{title}</h3>
      <div className="statusChart">
        {visible.length ? visible.map((point) => (
          <div key={point.key}>
            <StatusBadge tone="neutral">{point.label}</StatusBadge>
            <strong>{point.value}</strong>
          </div>
        )) : <p className="muted">Keine Daten im Zeitraum.</p>}
      </div>
    </section>
  );
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.ADMIN]);
  const params = await searchParams;
  const filters = parseAnalyticsFilters(params);
  const [analytics, options, orderExperience, heatmap] = await Promise.all([
    getBusinessOverview(filters),
    getAnalyticsFilterOptions(),
    getOrderExperienceAnalytics(),
    getHeatmapData(),
  ]);
  const exportQuery = queryString({
    from: dateInput(filters.from),
    to: dateInput(filters.to),
    city: filters.city,
    customerId: filters.customerId,
    distributorId: filters.distributorId,
    status: filters.status,
  });

  await createAuditLog({
    userId: session.id,
    action: "analytics.viewed",
    entityType: "Analytics",
    entityId: "admin-page",
    newValues: { filters },
  });

  return (
    <PortalShell
      eyebrow="Adminbereich"
      title="Analytics"
      description="Geschäftszahlen, Plattformaktivität und operative Leistung auf einen Blick."
      navItems={[
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/orders", label: "Aufträge" },
        { href: "/admin/payments", label: "Payments" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/leads", label: "Leads" },
      ]}
    >
      <DataSection title="Filter" description="Standard ist der Zeitraum der letzten 30 Tage. Alle KPIs werden direkt aus operativen Tabellen berechnet.">
        <form className="form analyticsFilterGrid" action="/admin/analytics" method="get">
          <label>
            Von
            <input name="from" type="date" defaultValue={dateInput(filters.from)} />
          </label>
          <label>
            Bis
            <input name="to" type="date" defaultValue={dateInput(filters.to)} />
          </label>
          <label>
            Stadt
            <select name="city" defaultValue={filters.city ?? ""}>
              <option value="">Alle Städte</option>
              {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label>
            Kunde
            <select name="customerId" defaultValue={filters.customerId ?? ""}>
              <option value="">Alle Kunden</option>
              {options.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}
            </select>
          </label>
          <label>
            Verteiler
            <select name="distributorId" defaultValue={filters.distributorId ?? ""}>
              <option value="">Alle Verteiler</option>
              {options.distributors.map((distributor) => <option key={distributor.id} value={distributor.id}>{distributor.name}</option>)}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Alle Status</option>
              {options.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <button type="submit">Auswerten</button>
        </form>
      </DataSection>

      <section className="portalMetrics">
        <MetricTile label="Umsatz gesamt" value={formatCurrency(analytics.summary.totalRevenue)} tone="success" />
        <MetricTile label="Umsatz aktueller Monat" value={formatCurrency(analytics.summary.currentMonthRevenue)} />
        <MetricTile label="Bezahlte Aufträge" value={analytics.summary.paidOrders} tone="success" />
        <MetricTile label="Offene Aufträge" value={analytics.summary.openOrders} tone="warning" />
        <MetricTile label="Abgeschlossene Touren" value={analytics.summary.completedTours} />
        <MetricTile label="Neue Leads" value={analytics.summary.newLeads} />
        <MetricTile label="Gewonnene Leads" value={analytics.summary.wonLeads} tone="success" />
        <MetricTile label="Verlorene Leads" value={analytics.summary.lostLeads} tone="danger" />
        <MetricTile label="Offene Follow-ups" value={analytics.summary.openFollowUps} tone="warning" />
        <MetricTile label="Aktive Kunden" value={analytics.summary.activeCustomers} />
        <MetricTile label="Aktive Verteiler" value={analytics.summary.activeDistributors} />
        <MetricTile label="Offene Zahlungen" value={analytics.summary.openPayments} tone="warning" />
        <MetricTile label="Refunds" value={analytics.summary.refunds} tone="danger" />
        <MetricTile label="Veröffentlichte Reports" value={analytics.summary.publishedReports} tone="success" />
      </section>

      <ActionPanel
        title="Analytics Export"
        description="CSV mit den aktuellen Filterdaten für operative Auswertung vorbereiten."
        actions={[{ href: `/api/admin/analytics/export?${exportQuery}`, label: "CSV exportieren" }]}
      />

      <div className="analyticsChartsGrid">
        <BarChart title="Umsatz pro Monat" points={analytics.revenue.revenueByMonth} currency />
        <BarChart title="Aufträge pro Monat" points={analytics.orders.ordersByMonth} />
        <BarChart title="Leads pro Monat" points={analytics.leads.leadsByMonth} />
        <BarChart title="Neue Leads pro Woche" points={analytics.leads.newLeadsByWeek} />
        <StatusChart title="Leads nach Status" points={analytics.leads.leadsByStatus} />
        <StatusChart title="Zahlungen nach Status" points={analytics.payments.paymentsByStatus} />
        <StatusChart title="Aufträge nach Status" points={analytics.orders.ordersByStatus} />
        <StatusChart title="Touren nach Status" points={analytics.distributors.toursByStatus} />
      </div>

      <DataSection title="Operative KPIs" description="Durchschnittswerte aus Zahlung, Lager, Dispatch, Tour und Bericht.">
        <div className="analyticsKpiGrid">
          <article><strong>{number(analytics.operational.averageTourDurationHours, " h")}</strong><span>Tourdauer</span></article>
          <article><strong>{number(analytics.operational.averageDistanceKm, " km")}</strong><span>Strecke</span></article>
          <article><strong>{number(analytics.operational.averageGpsScore, "/100")}</strong><span>GPS-Score</span></article>
          <article><strong>{number(analytics.operational.averageOrderToPaymentHours, " h")}</strong><span>Auftrag → Zahlung</span></article>
          <article><strong>{number(analytics.operational.averagePaymentToAdminApprovalHours, " h")}</strong><span>Zahlung → Adminfreigabe</span></article>
          <article><strong>{number(analytics.operational.averageWarehouseDays, " Tage")}</strong><span>Lagerzeit</span></article>
          <article><strong>{number(analytics.operational.averageDispatchHours, " h")}</strong><span>Dispatchzeit</span></article>
          <article><strong>{number(analytics.operational.averageTourToReportHours, " h")}</strong><span>Tourabschluss → Bericht</span></article>
        </div>
      </DataSection>

      <div className="portalDashboardGrid">
        <DataSection title="Top Kunden nach Umsatz">
          <div className="analyticsList">
            {analytics.customers.topCustomersByRevenue.map((customer) => (
              <article key={customer.customerId}>
                <span>{customer.companyName}</span>
                <strong>{formatCurrency(customer.revenue)}</strong>
              </article>
            ))}
          </div>
        </DataSection>
        <DataSection title="Top Kunden nach Auftragsanzahl">
          <div className="analyticsList">
            {analytics.customers.topCustomersByOrders.map((customer) => (
              <article key={customer.customerId}>
                <span>{customer.companyName}</span>
                <strong>{customer.orderCount}</strong>
              </article>
            ))}
          </div>
        </DataSection>
      </div>

      <DataSection
        title="Kunden-KPIs"
        description={`${analytics.customers.recurringCustomers} wiederkehrende Kunden, ${analytics.customers.inactiveCustomers} inaktive Kunden.`}
      >
        <p className="muted">Wiederkehrend bedeutet mindestens zwei Aufträge im Filterzeitraum. Inaktiv bedeutet kein Auftrag in den letzten 90 Tagen.</p>
      </DataSection>

      <DataSection title="Modul 24: Order Experience" description="UX-KPIs aus Smart-Order-Wizard, Autocomplete, Gebietsnutzung und Karteninteraktion.">
        <div className="analyticsKpiGrid">
          <article><strong>{number(orderExperience.timeToOrderMs / 1000, " s")}</strong><span>Zeit bis Auftrag</span></article>
          <article><strong>{orderExperience.abandonmentRate} %</strong><span>Wizard-Abbruchquote</span></article>
          <article><strong>{number(orderExperience.averagePolygonSqm / 1_000_000, " km²")}</strong><span>ø Polygongröße</span></article>
          <article><strong>{orderExperience.averageOrderDurationMinutes} min</strong><span>ø Auftragsdauer</span></article>
          <article><strong>{orderExperience.savedAreaUsage}</strong><span>Gespeicherte Gebiete</span></article>
          <article><strong>{orderExperience.autocompleteUsage}</strong><span>Autocomplete-Nutzung</span></article>
        </div>
        <div className="portalDashboardGrid" style={{ marginTop: 16 }}>
          <div>
            <h3 className="sectionTitle">Beliebteste Städte</h3>
            <div className="analyticsList">
              {orderExperience.popularCities.map((item) => <article key={item.city ?? "unknown"}><span>{item.city ?? "-"}</span><strong>{item.count}</strong></article>)}
            </div>
          </div>
          <div>
            <h3 className="sectionTitle">Beliebteste Gebiete</h3>
            <div className="analyticsList">
              {orderExperience.popularAreas.map((item) => <article key={item.areaName ?? "unknown"}><span>{item.areaName ?? "-"}</span><strong>{item.count}</strong></article>)}
            </div>
          </div>
        </div>
      </DataSection>

      <DataSection title="Smart Maps Heatmap" description="Auslastung, laufende Kampagnen und freie Gebiete aus Auftragshistorie und Gebietsbibliothek.">
        <div className="module24Heatmap">
          {heatmap.load.slice(0, 18).map((item) => (
            <article key={`${item.city}-${item.postalCode}-${item.status}`} style={{ opacity: 0.55 + item.intensity * 0.45 }}>
              <strong>{item.postalCode} {item.city}</strong>
              <span>{item.orders} Aufträge · {item.flyers} Flyer · {item.status}</span>
            </article>
          ))}
        </div>
      </DataSection>

      <DataSection title="Verteilerleistung">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Verteiler</th>
                <th>Abgeschlossene Touren</th>
                <th>Offene Touren</th>
                <th>Ablehnungsrate</th>
                <th>GPS-Score</th>
                <th>Pünktlichkeit</th>
                <th>Warnungen</th>
              </tr>
            </thead>
            <tbody>
              {analytics.distributors.distributorPerformance.map((distributor) => (
                <tr key={distributor.distributorId}>
                  <td>{distributor.name}</td>
                  <td>{distributor.completedTours}</td>
                  <td>{distributor.openTours}</td>
                  <td>{number(distributor.rejectionRate, " %")}</td>
                  <td>{number(distributor.averageGpsScore, "/100")}</td>
                  <td>{distributor.punctualityPrepared}</td>
                  <td>{distributor.warnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>

      <p className="muted">
        APIs: <Link className="textLink" href={`/api/admin/analytics?${exportQuery}`}>Overview JSON</Link>
      </p>
    </PortalShell>
  );
}
