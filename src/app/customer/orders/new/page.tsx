import { UserRole } from "@prisma/client";
import { SmartOrderWizard } from "@/app/customer/orders/new/SmartOrderWizard";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCustomerOrderPage() {
  await requireRole([UserRole.CUSTOMER]);
  const today = new Date().toISOString().slice(0, 10);
  const areas = await prisma.distributionArea.findMany({
    where: { reusable: true, status: "ACTIVE" },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      postalCode: true,
      district: true,
      estimatedHouseholds: true,
      estimatedFlyers: true,
      estimatedDistanceMeters: true,
      coverageAreaSqm: true,
      geoJson: true,
      centerLat: true,
      centerLng: true,
      radiusMeters: true,
    },
  });
  const areaOptions = areas.map((area) => ({
    ...area,
    coverageAreaSqm: area.coverageAreaSqm ? Number(area.coverageAreaSqm) : null,
    centerLat: area.centerLat ? Number(area.centerLat) : null,
    centerLng: area.centerLng ? Number(area.centerLng) : null,
  }));

  return (
    <main className="orderExperienceShell">
      <header className="orderExperienceTopbar">
        <h1>Neue Kampagne starten</h1>
        <span>Automatische Speicherung</span>
        <div className="orderTopActions" aria-label="Kontoaktionen">
          <span>Darkmode</span>
          <span>Nachrichten</span>
          <strong>Kundenkonto</strong>
        </div>
      </header>
      <SmartOrderWizard areas={areaOptions} today={today} />
    </main>
  );
}
