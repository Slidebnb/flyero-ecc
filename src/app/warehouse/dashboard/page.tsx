import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { inventoryScopeForUser, shipmentScopeForUser, transferScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { warehouseLocationSelect, warehouseOrderSelect } from "@/lib/warehousePrivacy";

const warehouseNav = [
  { href: "/warehouse/dashboard", label: "Dashboard" },
  { href: "/warehouse/checkin", label: "Wareneingang" },
  { href: "/warehouse/shipments", label: "Lieferungen" },
  { href: "/warehouse/transfers", label: "Umlagerungen" },
  { href: "/warehouse/stock-counts", label: "Inventur" },
  { href: "/warehouse/inventory", label: "Bestand" },
  { href: "/warehouse/locations", label: "Lagerplätze" },
];

export default async function WarehouseDashboardPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF]);
  const inventoryScope = inventoryScopeForUser(session);

  const [expected, received, stored, ready, remainingStock, openShipments, openTransfers, recent] = await Promise.all([
    prisma.warehouseInventory.count({ where: { ...inventoryScope, status: "FLYERS_EXPECTED" } }),
    prisma.warehouseInventory.count({ where: { ...inventoryScope, status: "FLYERS_RECEIVED" } }),
    prisma.warehouseInventory.count({ where: { ...inventoryScope, status: "STORED" } }),
    prisma.warehouseInventory.count({ where: { ...inventoryScope, status: "READY_FOR_PICKUP" } }),
    prisma.warehouseInventory.count({ where: { ...inventoryScope, remainingStockStatus: { not: "NOT_RELEVANT" } } }),
    prisma.logisticsShipment.count({ where: { ...shipmentScopeForUser(session), status: { in: ["CREATED", "IN_TRANSIT", "DELIVERED"] } } }),
    prisma.warehouseTransfer.count({ where: { ...transferScopeForUser(session), status: { in: ["REQUESTED", "APPROVED", "IN_TRANSIT"] } } }),
    prisma.warehouseInventory.findMany({
      where: inventoryScope,
      take: 8,
      select: {
        id: true,
        status: true,
        expectedFlyers: true,
        remainingFlyers: true,
        order: { select: warehouseOrderSelect },
        warehouseLocation: { select: warehouseLocationSelect },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <PortalShell
      eyebrow="Lager"
      title="Lager-Dashboard"
      description="Wareneingang, Lieferungen, Umlagerungen und Inventur für dein zugewiesenes Lager."
      navItems={warehouseNav}
    >
      <section className="portalMetrics">
        <MetricTile label="Flyer erwartet" value={expected} tone="warning" />
        <MetricTile label="Angekommen" value={received} />
        <MetricTile label="Im Lager" value={stored} />
        <MetricTile label="Abholbereit" value={ready} tone="success" />
        <MetricTile label="Restbestände" value={remainingStock} />
        <MetricTile label="Offene Lieferungen" value={openShipments} tone={openShipments ? "warning" : "success"} />
        <MetricTile label="Umlagerungen" value={openTransfers} tone={openTransfers ? "warning" : "success"} />
      </section>

      <ActionPanel
        title="Nächster Lagerschritt"
        description="Wareneingang scannen, Lieferung prüfen, Umlagerung empfangen oder Inventur durchführen."
        actions={[
          { href: "/warehouse/checkin", label: "Flyer einchecken" },
          { href: "/warehouse/shipments", label: "Lieferungen" },
          { href: "/warehouse/transfers", label: "Umlagerungen" },
          { href: "/warehouse/stock-counts", label: "Inventur" },
          { href: "/warehouse/inventory", label: "Bestand öffnen" },
        ]}
      />

      <DataSection
        title="Aktuelle Lagerbewegungen"
        description="Die zuletzt aktualisierten Bestände mit Lagerplatz und Flyerzahl."
      >
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Status</th>
                <th>Platz</th>
                <th>Flyer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td>{item.order.orderNumber}</td>
                  <td>{WAREHOUSE_INVENTORY_STATUS_LABELS[item.status]}</td>
                  <td>{item.warehouseLocation?.fullLabel ?? "-"}</td>
                  <td>{item.remainingFlyers ?? item.expectedFlyers}</td>
                  <td><Link className="textLink" href={`/warehouse/inventory/${item.id}`}>Öffnen</Link></td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      title="Noch keine Lagerbestände vorhanden."
                      description="Sobald Flyer im Wareneingang eingecheckt werden, erscheinen sie hier mit Lagerplatz und Status."
                      action={{ href: "/warehouse/checkin", label: "Wareneingang öffnen" }}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
