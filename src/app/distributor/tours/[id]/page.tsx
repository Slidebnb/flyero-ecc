import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { TourClient } from "./TourClient";
import { requireRole } from "@/lib/auth";
import { TOUR_STATUS_LABELS, WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { formatAddress, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function DistributorTourDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const profile = await prisma.distributorProfile.findUnique({ where: { userId: session.id } });
  if (!profile) notFound();
  const { id } = await params;
  const tour = await prisma.distributionTour.findFirst({
    where: { id, distributorId: profile.id },
    include: {
      order: { include: { customer: true } },
      inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
      gpsPoints: { orderBy: { recordedAt: "desc" }, take: 5 },
      photoProofs: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!tour) notFound();
  const warehouse = tour.inventory?.warehouseLocation?.warehouse;

  return (
    <main className="appShell mobileAppShell">
      <header className="mobileTopbar">
        <div>
          <p className="eyebrow">Tour</p>
          <h1>{tour.order.orderNumber}</h1>
          <span className="badge">{TOUR_STATUS_LABELS[tour.status]}</span>
        </div>
        <Link className="textLink" href="/distributor/dashboard">Zurueck</Link>
      </header>

      <section className="mobileCard">
        <h2 className="sectionTitle">Auftrag</h2>
        <div className="statusBox">
          <span>Kunde: {tour.order.customer.companyName}</span>
          <span>Flyer: {tour.inventory?.expectedFlyers ?? tour.order.flyerQuantity}</span>
          <span>Kartons: {tour.inventory?.cartonCount ?? "-"}</span>
          <span>QR-Code Status: {tour.inventory ? WAREHOUSE_INVENTORY_STATUS_LABELS[tour.inventory.status] : "-"}</span>
          <span>Regal: {tour.inventory?.warehouseLocation?.fullLabel ?? "-"}</span>
          <span>Lageradresse:</span>
          <span style={{ whiteSpace: "pre-line" }}>{warehouse ? formatAddress(warehouse.address) : "-"}</span>
        </div>
      </section>

      <TourClient tourId={tour.id} qrCode={tour.inventory?.qrCode} status={tour.status} />

      <section className="mobileCard">
        <h2 className="sectionTitle">Nachweise</h2>
        <p className="muted">GPS-Punkte: {tour.gpsPoints.length}</p>
        <p className="muted">Fotos: {tour.photoProofs.length}</p>
        <p className="muted">Start: {formatDateTime(tour.startTime ?? tour.startedAt)}</p>
        <p className="muted">Ende: {formatDateTime(tour.endTime ?? tour.completedAt)}</p>
      </section>
    </main>
  );
}
