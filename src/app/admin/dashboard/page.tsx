import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { ActionPanel, DataSection, MetricTile } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productionCustomerWhere, productionDistributorWhere, productionInventoryWhere, productionLeadWhere, productionOrderWhere, productionSupportTicketWhere, productionTourWhere, productionUserWhere } from "@/lib/productionData";

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
    prisma.customerProfile.count({ where: productionCustomerWhere() }),
    prisma.distributorProfile.count({ where: productionDistributorWhere() }),
    prisma.distributorProfile.count({ where: { ...productionDistributorWhere(), reviewStatus: "PENDING_REVIEW" } }),
    prisma.user.count({ where: { ...productionUserWhere(), role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.user.count({ where: { ...productionUserWhere(), role: { in: ["ADMIN", "SUPPORT_DISPATCHER"] } } }),
    prisma.order.count({ where: { ...productionOrderWhere(), status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED"] } } }),
    prisma.order.count({ where: { ...productionOrderWhere(), status: "PAID_WAITING_FOR_ADMIN_REVIEW" } }),
    prisma.warehouseInventory.count({ where: { ...productionInventoryWhere(), status: "READY_FOR_PICKUP" } }),
    prisma.distributionTour.count({ where: { ...productionTourWhere(), status: "UNDER_REVIEW" } }),
    prisma.lead.count({ where: { ...productionLeadWhere(), status: "NEW", archivedAt: null } }),
    prisma.supportTicket.count({ where: { ...productionSupportTicketWhere(), status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.supportTicket.count({ where: { ...productionSupportTicketWhere(), priority: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);

  return (
    <AdminPortalShell
      eyebrow="Adminbereich"
      title="Übersicht"
      description="Operativer Kontrollraum für Aufträge, Leads, Zahlungen, Lager und Tourprüfung."
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
    </AdminPortalShell>
  );
}
