import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value)} %`;
}

export default async function CustomerDashboardPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
    select: { id: true, companyName: true, contactName: true },
  });

  if (!profile) {
    return (
      <CustomerPortalShell active="/customer/dashboard" title="Dashboard" description="Kundenprofil wurde nicht gefunden.">
        <EmptyState title="Kundenprofil wurde nicht gefunden." description="Bitte melden Sie sich erneut an oder kontaktieren Sie den Support." />
      </CustomerPortalShell>
    );
  }

  const [
    activeOrders,
    plannedOrders,
    completedOrders,
    reports,
    invoices,
    openSupportTickets,
    lastOrder,
  ] = await Promise.all([
    prisma.order.count({
      where: { customerId: profile.id, status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED", "PAID_WAITING_FOR_ADMIN_REVIEW", "WAITING_FOR_CUSTOMER", "APPROVED", "READY_FOR_FLYERS", "READY_FOR_PICKUP"] } },
    }),
    prisma.order.count({
      where: { customerId: profile.id, preferredStartDate: { gte: new Date() } },
    }),
    prisma.order.count({
      where: { customerId: profile.id, status: { in: ["REPORT_READY_PREVIEW", "DISTRIBUTION_APPROVED"] } },
    }),
    prisma.report.count({
      where: { status: "APPROVED", order: { customerId: profile.id }, tour: { status: "APPROVED" } },
    }),
    prisma.invoice.findMany({
      where: { customerId: profile.id },
      select: { totalGross: true, status: true },
    }),
    prisma.supportTicket.count({
      where: { customerId: profile.id, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.order.findFirst({
      where: { customerId: profile.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        targetAreaName: true,
        city: true,
        flyerQuantity: true,
        status: true,
        preferredStartDate: true,
        calculatedGrossPrice: true,
      },
    }),
  ]);

  const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID").length;
  const paidRate = invoices.length ? (paidInvoices / invoices.length) * 100 : 99;
  const distributedFlyers = lastOrder?.flyerQuantity ? completedOrders * lastOrder.flyerQuantity : 0;

  return (
    <CustomerPortalShell
      active="/customer/dashboard"
      title={`Guten Morgen${profile.contactName ? `, ${profile.contactName}` : ""}!`}
      description={profile.companyName ? `${profile.companyName} - Übersicht Ihrer aktuellen Aktivitäten.` : "Übersicht Ihrer aktuellen Aktivitäten."}
    >
      <section className="portalMetrics dashboardReferenceMetrics">
        <MetricTile label="Aktive Kampagnen" value={activeOrders} tone="success" />
        <MetricTile label="Geplante Verteilungen" value={plannedOrders} />
        <MetricTile label="Verteilte Flyer" value={formatNumber(distributedFlyers)} />
        <MetricTile label="Zahlungsquote" value={formatPercent(paidRate)} tone="success" />
      </section>

      <div className="portalDashboardGrid dashboardReferenceGrid">
        <DataSection title="Letzte Kampagne" description="Die aktuellste Kampagne aus Ihrem Kundenkonto.">
          {lastOrder ? (
            <article className="campaignSummaryCard">
              <div>
                <h3>{lastOrder.targetAreaName}</h3>
                <StatusBadge tone={lastOrder.status === "DISTRIBUTION_APPROVED" ? "success" : "warning"}>{lastOrder.status}</StatusBadge>
              </div>
              <dl>
                <div><dt>Verteilgebiet</dt><dd>{lastOrder.city}</dd></div>
                <div><dt>Startdatum</dt><dd>{lastOrder.preferredStartDate ? lastOrder.preferredStartDate.toLocaleDateString("de-DE") : "-"}</dd></div>
                <div><dt>Verteilte Flyer</dt><dd>{formatNumber(lastOrder.flyerQuantity)}</dd></div>
                <div><dt>Preis</dt><dd>{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(lastOrder.calculatedGrossPrice))}</dd></div>
              </dl>
              <Link href={`/customer/orders/${lastOrder.id}`}>Kampagne ansehen<span aria-hidden="true">→</span></Link>
            </article>
          ) : (
            <EmptyState title="Noch keine Kampagne vorhanden." description="Erstellen Sie Ihre erste Kampagne und erreichen Sie neue Kunden in Ihrer Region." action={{ href: "/customer/orders/new", label: "Neue Kampagne erstellen" }} />
          )}
        </DataSection>

        <DataSection title="Verteilungen" description="Ihre Gebiete, Touren und Nachweise laufen im Portal zusammen.">
          <div className="dashboardMapPreview" aria-label="Verteilgebiet Vorschau">
            <span />
            <span />
            <span />
          </div>
          <Link className="dashboardOutlineButton" href="/customer/orders">Alle Verteilgebiete anzeigen<span aria-hidden="true">→</span></Link>
        </DataSection>

        <DataSection title="Aufgaben" description="Was als Nächstes Aufmerksamkeit braucht.">
          <div className="taskList">
            <Link href="/customer/orders/new"><span>○</span>Neue Kampagne vorbereiten</Link>
            <Link href="/customer/documents"><span>○</span>Druckdaten hochladen</Link>
            <Link href="/customer/invoices"><span>○</span>Rechnungen prüfen</Link>
            <Link href="/customer/support"><span>○</span>Support offen: {openSupportTickets}</Link>
          </div>
        </DataSection>

        <DataSection title="Ergebnisse" description="Berichte und Rechnungen aus abgeschlossenen Kampagnen.">
          <div className="dashboardResultStrip">
            <article><strong>{reports}</strong><span>freigegebene Berichte</span></article>
            <article><strong>{completedOrders}</strong><span>abgeschlossene Kampagnen</span></article>
            <article><strong>{invoices.length}</strong><span>Rechnungen</span></article>
          </div>
        </DataSection>
      </div>
    </CustomerPortalShell>
  );
}
