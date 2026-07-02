import { UserRole } from "@prisma/client";
import { ActionPanel, MetricTile, PortalShell } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomerDashboardPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const profile = await prisma.customerProfile.findUnique({
    where: { userId: session.id },
    select: { companyName: true, contactName: true },
  });
  const [openOrders, runningOrders, completedOrders, reports, openSupportTickets] = await Promise.all([
    prisma.order.count({
      where: { customer: { userId: session.id }, status: { in: ["PAYMENT_PENDING", "PAYMENT_FAILED", "PAID_WAITING_FOR_ADMIN_REVIEW", "WAITING_FOR_CUSTOMER"] } },
    }),
    prisma.order.count({
      where: { customer: { userId: session.id }, status: { in: ["APPROVED", "READY_FOR_FLYERS", "READY_FOR_PICKUP"] } },
    }),
    prisma.order.count({
      where: { customer: { userId: session.id }, status: { in: ["REPORT_READY_PREVIEW", "DISTRIBUTION_APPROVED"] } },
    }),
    prisma.report.count({
      where: { status: "APPROVED", order: { customer: { userId: session.id } }, tour: { status: "APPROVED" } },
    }),
    prisma.supportTicket.count({
      where: { customer: { userId: session.id }, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
  ]);

  return (
    <PortalShell
      eyebrow="Kundenportal"
      title={`Willkommen${profile ? `, ${profile.contactName}` : ""}`}
      description={profile?.companyName ? `${profile.companyName} - Aufträge, Zahlungen, Berichte und Rechnungen an einem Ort.` : "Aufträge, Zahlungen, Berichte und Rechnungen an einem Ort."}
      navItems={[
        { href: "/customer/orders", label: "Aufträge" },
        { href: "/customer/payments", label: "Zahlungen" },
        { href: "/customer/invoices", label: "Rechnungen" },
        { href: "/customer/reports", label: "Berichte" },
        { href: "/customer/documents", label: "Dokumente" },
        { href: "/customer/support", label: "Support" },
        { href: "/customer/notifications", label: "Nachrichten" },
        { href: "/customer/profile", label: "Profil" },
      ]}
    >
      <section className="portalMetrics">
        <MetricTile label="Offene Aufträge" value={openOrders} tone="warning" />
        <MetricTile label="Laufende Aufträge" value={runningOrders} />
        <MetricTile label="Abgeschlossen" value={completedOrders} tone="success" />
        <MetricTile label="Berichtsvorschauen" value={reports} />
        <MetricTile label="Support offen" value={openSupportTickets} tone={openSupportTickets ? "warning" : "success"} />
      </section>

      <ActionPanel
        title="Aufträge und Berichte"
        description="Starte einen neuen Auftrag oder prüfe Zahlungen, Rechnungen und freigegebene Berichtsvorschauen."
        actions={[
          { href: "/customer/orders/new", label: "Neuen Auftrag erstellen" },
          { href: "/customer/orders", label: "Meine Aufträge" },
          { href: "/customer/payments", label: "Zahlungen" },
          { href: "/customer/invoices", label: "Rechnungen" },
          { href: "/customer/reports", label: "Berichte ansehen" },
          { href: "/customer/documents", label: "Dokumente & Druck" },
          { href: "/customer/support", label: "Support öffnen" },
          { href: "/customer/notifications", label: "Nachrichten" },
        ]}
      />
    </PortalShell>
  );
}
