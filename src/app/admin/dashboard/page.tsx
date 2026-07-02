import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ActionPanel, DataSection, MetricTile, PortalShell } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  await requireRole([UserRole.ADMIN]);

  const [
    newCustomers,
    newDistributors,
    pendingDistributors,
    activeCustomers,
    adminCount,
    paymentPendingOrders,
    paidReviewOrders,
    warehouseReady,
    toursUnderReview,
    newLeads,
    openSupportTickets,
    urgentSupportTickets,
  ] = await Promise.all([
    prisma.customerProfile.count(),
    prisma.distributorProfile.count(),
    prisma.distributorProfile.count({ where: { reviewStatus: "PENDING_REVIEW" } }),
    prisma.user.count({ where: { role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.user.count({ where: { role: { in: ["ADMIN", "SUPPORT_DISPATCHER"] } } }),
    prisma.order.count({ where: { status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] } } }),
    prisma.order.count({ where: { status: "PAID_WAITING_FOR_ADMIN_REVIEW" } }),
    prisma.warehouseInventory.count({ where: { status: "READY_FOR_PICKUP" } }),
    prisma.distributionTour.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.lead.count({ where: { status: "NEW", archivedAt: null } }),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.supportTicket.count({ where: { priority: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);

  return (
    <PortalShell
      eyebrow="Adminbereich"
      title="Übersicht"
      description="Operativer Kontrollraum für Aufträge, Leads, Zahlungen, Lager und Tourprüfung."
      navItems={[
        { href: "/admin/orders", label: "Aufträge" },
        { href: "/admin/orders?status=PAID_WAITING_FOR_ADMIN_REVIEW", label: "Bezahlte Prüfung" },
        { href: "/admin/payments", label: "Payments" },
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/crm", label: "CRM" },
        { href: "/admin/support", label: "Support" },
        { href: "/admin/documents", label: "Dokumente" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/monitoring", label: "Monitoring" },
        { href: "/admin/invoices", label: "Rechnungen" },
        { href: "/admin/accounting", label: "Buchhaltung" },
        { href: "/admin/distributors", label: "Verteilerprüfung" },
        { href: "/admin/warehouse", label: "Lager" },
        { href: "/admin/logistics", label: "Logistik" },
        { href: "/admin/settings", label: "Einstellungen" },
        { href: "/admin/tours", label: "Touren" },
      ]}
    >
      <section className="portalMetrics">
        <MetricTile label="Neue Kunden" value={newCustomers} />
        <MetricTile label="Neue Verteiler" value={newDistributors} />
        <MetricTile label="Verteiler in Prüfung" value={pendingDistributors} tone="warning" />
        <MetricTile label="Aktive Kunden" value={activeCustomers} tone="success" />
        <MetricTile label="Admins & Support" value={adminCount} />
        <MetricTile label="Zahlung offen" value={paymentPendingOrders} tone="warning" />
        <MetricTile label="Bezahlte Prüfung" value={paidReviewOrders} />
        <MetricTile label="Abholbereit im Lager" value={warehouseReady} tone="success" />
        <MetricTile label="Touren in Prüfung" value={toursUnderReview} tone="warning" />
        <MetricTile label="Neue Leads" value={newLeads} />
        <MetricTile label="Support offen" value={openSupportTickets} tone={openSupportTickets ? "warning" : "success"} />
        <MetricTile label="Dringende Tickets" value={urgentSupportTickets} tone={urgentSupportTickets ? "danger" : "success"} />
      </section>

      <div className="portalDashboardGrid">
        <ActionPanel
          title="Operative Prüfung"
          description="Bezahlte Aufträge, Verteilerfreigaben und Tourprüfungen priorisiert abarbeiten."
          actions={[
            { href: "/admin/orders?status=PAID_WAITING_FOR_ADMIN_REVIEW", label: "Aufträge prüfen" },
            { href: "/admin/distributors", label: "Verteiler prüfen" },
            { href: "/admin/tours", label: "Touren prüfen" },
            { href: "/admin/crm", label: "CRM öffnen" },
          ]}
        />
        <DataSection
          title="Systemsteuerung"
          description="Zentrale Bereiche für Buchhaltung, Einstellungen, Benachrichtigungen und Monitoring."
        >
          <div className="portalActions">
            <Link href="/admin/accounting">Buchhaltung</Link>
            <Link href="/admin/settings">Einstellungen</Link>
            <Link href="/admin/notifications">Benachrichtigungen</Link>
            <Link href="/admin/analytics">Analytics</Link>
            <Link href="/admin/monitoring">Monitoring</Link>
          </div>
        </DataSection>
      </div>
    </PortalShell>
  );
}
