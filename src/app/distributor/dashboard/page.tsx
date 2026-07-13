import Link from "next/link";
import { DistributorReviewStatus, UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import {
  DISPATCH_REJECTION_REASON_LABELS,
  DISTRIBUTOR_STATUS_LABELS,
  TOUR_STATUS_LABELS,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { distributorInventorySelect, distributorOrderSelect } from "@/lib/distributorPrivacy";

function statusBadgeTone(status: DistributorReviewStatus): "success" | "danger" | "warning" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED" || status === "BANNED") return "danger";
  return "warning";
}

export default async function DistributorDashboardPage() {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const profile = await prisma.distributorProfile.findUnique({
    where: { userId: session.id },
    include: {
      dispatchAssignments: {
        where: { status: "ASSIGNED" },
        include: {
          order: { select: distributorOrderSelect },
          inventory: { select: distributorInventorySelect },
        },
        orderBy: { assignedAt: "desc" },
      },
      tours: {
        include: { order: { select: distributorOrderSelect }, inventory: { select: distributorInventorySelect } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!profile) {
    return <main className="appShell">Verteilerprofil wurde nicht gefunden.</main>;
  }

  const isApproved = profile.reviewStatus === "APPROVED";
  const openTours = profile.tours.filter((tour) => ["ASSIGNED", "READY", "PICKED_UP"].includes(tour.status));
  const runningTour = profile.tours.find((tour) => ["STARTED", "PAUSED", "RESUMED"].includes(tour.status));
  const completedTours = profile.tours.filter((tour) => ["COMPLETED", "UNDER_REVIEW", "APPROVED"].includes(tour.status));
  const nextTour = runningTour ?? openTours[0] ?? completedTours[0];
  const openSupportTickets = await prisma.supportTicket.count({
    where: { distributorId: profile.id, status: { notIn: ["RESOLVED", "CLOSED"] } },
  });

  return (
    <PortalShell
      eyebrow="Verteiler-App"
      title="Heute"
      description="Neue Anfragen, laufende Touren und Abholinformationen in einer kompakten Arbeitsansicht."
      navItems={[
        { href: "/distributor/dashboard", label: "Heute" },
        { href: "/distributor/tours", label: "Touren" },
        { href: "/distributor/support", label: "Support" },
        { href: "/distributor/notifications", label: "Nachrichten" },
      ]}
    >
      {!isApproved ? (
        <section className="notice">
          <strong>Dein Profil wird aktuell geprüft.</strong>
          <br />
          Bis zur Freigabe sind keine Touren sichtbar.
        </section>
      ) : null}

      <section className="portalMetrics">
        <MetricTile label="Neue Anfragen" value={profile.dispatchAssignments.length} tone="warning" />
        <MetricTile label="Offene Touren" value={openTours.length} />
        <MetricTile label="Laufende Tour" value={runningTour ? 1 : 0} tone={runningTour ? "success" : "neutral"} />
        <MetricTile label="Support offen" value={openSupportTickets} tone={openSupportTickets ? "warning" : "success"} />
      </section>

      <ActionPanel
        title="Arbeitsmodus"
        description={nextTour ? "Öffne deine nächste Tour oder prüfe neue Nachrichten." : "Sobald eine Tour zugewiesen wird, erscheint sie hier als nächste Aktion."}
        actions={[
          ...(nextTour ? [{ href: `/distributor/tours/${nextTour.id}`, label: "Tour öffnen" }] : []),
          { href: "/distributor/notifications", label: "Nachrichten öffnen" },
        ]}
      />

      <section className="dataSection profileStatusPanel">
        <StatusBadge tone={statusBadgeTone(profile.reviewStatus)}>
          {DISTRIBUTOR_STATUS_LABELS[profile.reviewStatus]}
        </StatusBadge>
        <p className="muted">Einsatzorte: {profile.preferredAreas.join(", ")}</p>
      </section>

      <DataSection title="Neue Aufträge">
        {profile.dispatchAssignments.map((assignment) => (
          <article className="mobileCard stack" key={assignment.id}>
            <div>
              <strong>{assignment.order.orderNumber}</strong>
              <p className="muted">
                {assignment.order.city} / {assignment.order.flyerQuantity} Flyer
              </p>
              <small>
                {assignment.inventory?.warehouseLocation?.warehouse.name ?? "Lager"} /
                {" "}{assignment.inventory?.warehouseLocation?.fullLabel ?? "-"}
              </small>
            </div>
            <form action={`/api/distributor/orders/${assignment.orderId}/accept`} method="post">
              <button type="submit">Annehmen</button>
            </form>
            <form action={`/api/distributor/orders/${assignment.orderId}/reject`} method="post" className="form grid">
              <label>
                Ablehnungsgrund
                <select name="reason" required defaultValue="KEINE_ZEIT">
                  {Object.entries(DISPATCH_REJECTION_REASON_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Notiz optional
                <input name="note" />
              </label>
              <button type="submit">Ablehnen</button>
            </form>
          </article>
        ))}
        {profile.dispatchAssignments.length === 0 ? (
          <EmptyState title="Keine neuen Auftragsanfragen." description="Sobald ein Auftrag zugewiesen wird, erscheint er hier." />
        ) : null}
      </DataSection>

      <DataSection title="Touren">
        {profile.tours.map((tour) => (
          <Link className="mobileListItem" href={`/distributor/tours/${tour.id}`} key={tour.id}>
            <strong>{tour.order.orderNumber}</strong>
            <span>{TOUR_STATUS_LABELS[tour.status]}</span>
            <small>{tour.inventory?.warehouseLocation?.warehouse.name ?? "Lager"} / {tour.inventory?.warehouseLocation?.fullLabel ?? "-"}</small>
            <small>{formatDateTime(tour.updatedAt)}</small>
          </Link>
        ))}
        {profile.tours.length === 0 ? (
          <EmptyState title="Heute sind keine Touren zugewiesen." description="Freigegebene Touren werden hier als Arbeitsliste angezeigt." />
        ) : null}
      </DataSection>
    </PortalShell>
  );
}
