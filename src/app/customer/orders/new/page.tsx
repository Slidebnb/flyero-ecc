import { SmartOrderWizard } from "@/app/customer/orders/new/SmartOrderWizard";
import { requireTenantSession } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { productionAreaWhere } from "@/lib/productionData";
import { MobileMenu } from "@/app/components/MobileMenu";

export default async function NewCustomerOrderPage() {
  const session = await requireTenantSession();
  const today = new Date().toISOString().slice(0, 10);
  const areas = await prisma.distributionArea.findMany({
    where: {
      reusable: true,
      status: "ACTIVE",
      OR: [{ tenantId: null }, { tenantId: session.tenantId }],
      ...productionAreaWhere(),
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      city: true,
      postalCode: true,
      district: true,
      googlePlaceId: true,
      googleFeatureType: true,
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
          <strong>Kundenkonto</strong>
        </div>
        <MobileMenu
          items={[
            { label: "Übersicht", href: "/customer/dashboard" },
            { label: "Kampagnen", href: "/customer/orders" },
            { label: "Nachweise", href: "/customer/reports" },
            { label: "Rechnungen", href: "/customer/invoices" },
            { label: "Hilfe", href: "/customer/support" },
          ]}
          cta={{ label: "Neue Verteilung", href: "/customer/orders/new?fresh=1" }}
          showLogout
        />
      </header>
      <SmartOrderWizard areas={areaOptions} today={today} />
    </main>
  );
}
