import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { TOUR_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distributorInventorySelect, distributorOrderSelect } from "@/lib/distributorPrivacy";

export default async function DistributorToursPage() {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const profile = await prisma.distributorProfile.findUnique({
    where: { userId: session.id },
    include: {
      tours: {
        include: {
          order: { select: distributorOrderSelect },
          inventory: { select: distributorInventorySelect },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!profile) {
    return <main className="appShell">Verteilerprofil wurde nicht gefunden.</main>;
  }

  return (
    <PortalShell
      eyebrow="Verteiler-App"
      title="Touren"
      description="Alle dir zugewiesenen Touren an einem Ort. Öffne eine Tour, um Abholung, Start und Nachweise zu bearbeiten."
      navItems={[
        { href: "/distributor/dashboard", label: "Heute" },
        { href: "/distributor/tours", label: "Touren" },
        { href: "/distributor/support", label: "Support" },
        { href: "/distributor/notifications", label: "Nachrichten" },
      ]}
    >
      <DataSection title="Deine Touren" description="Die aktuellsten Touren stehen oben.">
        {profile.tours.map((tour) => (
          <Link className="mobileListItem" href={`/distributor/tours/${tour.id}`} key={tour.id}>
            <span>
              <strong>{tour.order.orderNumber}</strong>
              <small>{tour.order.targetAreaName} · {tour.order.city}</small>
            </span>
            <StatusBadge tone={tour.status === "COMPLETED" || tour.status === "APPROVED" ? "success" : tour.status === "REJECTED" || tour.status === "CANCELLED" ? "danger" : "warning"}>
              {TOUR_STATUS_LABELS[tour.status]}
            </StatusBadge>
            <small>{tour.inventory?.warehouseLocation?.warehouse.name ?? "Lager folgt"}</small>
            <small>{formatDateTime(tour.updatedAt)}</small>
          </Link>
        ))}
        {profile.tours.length === 0 ? (
          <EmptyState title="Noch keine Touren zugewiesen." description="Sobald dir eine Tour zugewiesen wird, erscheint sie hier." />
        ) : null}
      </DataSection>
    </PortalShell>
  );
}
