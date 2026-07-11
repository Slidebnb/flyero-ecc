import { UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

function statusTone(status: string) {
  if (status === "READY_FOR_PICKUP") return "success";
  if (status === "MISSING" || status === "DAMAGED") return "danger";
  if (status === "INBOUND" || status === "CHECKED_IN") return "warning";
  return "neutral";
}

export default async function AdminWarehousePage() {
  await requireRole([UserRole.ADMIN]);

  const [warehouses, locations, inventory] = await Promise.all([
    prisma.warehouse.count(),
    prisma.warehouseLocation.count(),
    prisma.warehouseInventory.findMany({
      include: { order: { include: { customer: true } }, warehouseLocation: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const readyForPickup = inventory.filter((item) => item.status === "READY_FOR_PICKUP").length;
  const expectedFlyers = inventory.reduce((sum, item) => sum + item.expectedFlyers, 0);
  const remainingFlyers = inventory.reduce((sum, item) => sum + (item.remainingFlyers ?? item.expectedFlyers), 0);

  return (
    <AdminPortalShell
      title="Lager"
      description="Wareneingang, Lagerplätze und abholbereite Flyer zentral prüfen."
    >
      <section className="portalMetrics">
        <MetricTile label="Lager" value={warehouses} />
        <MetricTile label="Lagerplätze" value={locations} />
        <MetricTile label="Aktive Bestände" value={inventory.length} />
        <MetricTile label="Abholbereit" value={readyForPickup} tone={readyForPickup ? "success" : "neutral"} />
        <MetricTile label="Erwartete Flyer" value={expectedFlyers.toLocaleString("de-DE")} />
        <MetricTile label="Restmenge" value={remainingFlyers.toLocaleString("de-DE")} />
      </section>

      <DataSection
        title="Lagerbestände"
        description="Die wichtigsten Lagerbewegungen und Abholzustände auf einen Blick."
      >
        {inventory.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Auftrag</th>
                  <th>Kunde</th>
                  <th>Status</th>
                  <th>Lagerplatz</th>
                  <th>Erwartet</th>
                  <th>Rest</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.order.orderNumber}</td>
                    <td>{item.order.customer.companyName}</td>
                    <td>
                      <StatusBadge tone={statusTone(item.status)}>
                        {WAREHOUSE_INVENTORY_STATUS_LABELS[item.status]}
                      </StatusBadge>
                    </td>
                    <td>{item.warehouseLocation?.fullLabel ?? "-"}</td>
                    <td>{item.expectedFlyers.toLocaleString("de-DE")}</td>
                    <td>{(item.remainingFlyers ?? item.expectedFlyers).toLocaleString("de-DE")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Noch keine Lagerbestände vorhanden."
            description="Sobald Druckdaten oder Flyer im Lager eingecheckt werden, erscheint hier die operative Übersicht."
          />
        )}
      </DataSection>
    </AdminPortalShell>
  );
}
