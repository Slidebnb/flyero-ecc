import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DataSection, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminWarehouseDetailPage({ params }: PageProps) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const { id } = await params;
  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      regions: { orderBy: [{ priority: "desc" }, { name: "asc" }] },
      locations: { orderBy: { fullLabel: "asc" } },
      inventories: { include: { order: { include: { customer: true } }, warehouseLocation: true }, orderBy: { updatedAt: "desc" }, take: 40 },
      shipments: { include: { order: true }, orderBy: { createdAt: "desc" }, take: 30 },
      transfersFrom: { include: { toWarehouse: true, inventory: { include: { order: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      transfersTo: { include: { fromWarehouse: true, inventory: { include: { order: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
      stockCounts: { include: { inventory: { include: { order: true } }, countedBy: true }, orderBy: { countedAt: "desc" }, take: 20 },
    },
  });
  if (!warehouse) notFound();
  const utilizationPercent = warehouse.capacityLimit ? Math.round((warehouse.currentUtilization / warehouse.capacityLimit) * 100) : "-";

  return (
    <PortalShell
      eyebrow="Admin Logistik"
      title={warehouse.name}
      description={`${warehouse.code} / ${warehouse.postalCode} ${warehouse.city}`}
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Auslastung" value={`${utilizationPercent}%`} tone={typeof utilizationPercent === "number" && utilizationPercent > 90 ? "warning" : "neutral"} />
        <MetricTile label="Kapazität" value={warehouse.capacityLimit ?? "-"} />
        <MetricTile label="Bestände" value={warehouse.inventories.length} />
        <MetricTile label="Offene Sendungen" value={warehouse.shipments.filter((item) => item.status !== "RECEIVED" && item.status !== "CANCELLED").length} tone="warning" />
      </section>

      <DataSection title="Stammdaten und Regionen">
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Status</th><td><StatusBadge tone={warehouse.isActive ? "success" : "danger"}>{warehouse.isActive ? "Aktiv" : "Inaktiv"}</StatusBadge></td></tr>
              <tr><th>Ansprechpartner</th><td>{warehouse.contactPerson ?? "-"} / {warehouse.contactPhone ?? "-"} / {warehouse.contactEmail ?? "-"}</td></tr>
              <tr><th>Öffnungszeiten</th><td>{warehouse.openingHours ?? "-"}</td></tr>
              <tr><th>Notizen</th><td>{warehouse.notes ?? "-"}</td></tr>
              <tr><th>Regionen</th><td>{warehouse.regions.map((region) => `${region.name} (${region.postalCodes.join(", ")})`).join(" / ") || "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Aktuelle Bestände">
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Kunde</th><th>Status</th><th>Platz</th><th>Flyer</th></tr></thead><tbody>
          {warehouse.inventories.map((item) => <tr key={item.id}><td>{item.order.orderNumber}</td><td>{item.order.customer.companyName}</td><td>{item.status}</td><td>{item.warehouseLocation?.fullLabel ?? "-"}</td><td>{item.remainingFlyers ?? item.expectedFlyers}</td></tr>)}
        </tbody></table></div>
      </DataSection>

      <DataSection title="Sendungen und Umlagerungen">
        <div className="tableWrap"><table><thead><tr><th>Typ</th><th>Referenz</th><th>Status</th><th>Details</th></tr></thead><tbody>
          {warehouse.shipments.map((item) => <tr key={item.id}><td>Sendung</td><td>{item.order.orderNumber}</td><td>{item.status}</td><td>{item.shipmentType}</td></tr>)}
          {warehouse.transfersFrom.map((item) => <tr key={item.id}><td>Umlagerung raus</td><td>{item.inventory.order.orderNumber}</td><td>{item.status}</td><td>zu {item.toWarehouse.name}</td></tr>)}
          {warehouse.transfersTo.map((item) => <tr key={item.id}><td>Umlagerung rein</td><td>{item.inventory.order.orderNumber}</td><td>{item.status}</td><td>von {item.fromWarehouse.name}</td></tr>)}
        </tbody></table></div>
      </DataSection>

      <Link className="textLink" href="/admin/logistics">Zurück zur Logistik-Zentrale</Link>
    </PortalShell>
  );
}
