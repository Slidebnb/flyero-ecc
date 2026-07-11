import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DataSection, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { getLogisticsAnalytics } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";


export default async function AdminLogisticsPage() {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const [analytics, warehouses, shipments, transfers, stockCounts] = await Promise.all([
    getLogisticsAnalytics(),
    prisma.warehouse.findMany({ include: { regions: true }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.logisticsShipment.findMany({ include: { order: true, warehouse: true }, orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }], take: 12 }),
    prisma.warehouseTransfer.findMany({ include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.warehouseStockCount.findMany({ where: { difference: { not: 0 } }, include: { warehouse: true, inventory: { include: { order: true } } }, orderBy: { countedAt: "desc" }, take: 10 }),
  ]);

  return (
    <PortalShell eyebrow="Admin Logistik" title="Logistik-Zentrale" description="Multi-Lager, Lieferungen, Umlagerungen und Inventurdifferenzen im Überblick." navItems={adminNavItems}>
      <section className="portalMetrics">
        <MetricTile label="Aktive Lager" value={warehouses.filter((item) => item.isActive).length} tone="success" />
        <MetricTile label="Offene Lieferungen" value={analytics.openShipments} tone={analytics.openShipments ? "warning" : "success"} />
        <MetricTile label="Verspätete Lieferungen" value={analytics.lateShipments} tone={analytics.lateShipments ? "danger" : "success"} />
        <MetricTile label="Beschädigte Lieferungen" value={analytics.damagedShipments} tone={analytics.damagedShipments ? "danger" : "success"} />
        <MetricTile label="Inventurdifferenzen" value={analytics.stockDifferences} tone={analytics.stockDifferences ? "warning" : "success"} />
        <MetricTile label="Ø Wareneingang h" value={analytics.averageReceivingHours} />
      </section>

      <DataSection title="Lagerübersicht" description="Kapazität, Regionen und Detailzugriff pro Standort.">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Lager</th><th>Code</th><th>Regionen</th><th>Auslastung</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td>{warehouse.name}</td>
                  <td>{warehouse.code}</td>
                  <td>{warehouse.regions.map((region) => region.name).join(", ") || "-"}</td>
                  <td>{warehouse.currentUtilization}/{warehouse.capacityLimit ?? "-"}</td>
                  <td><StatusBadge tone={warehouse.isActive ? "success" : "danger"}>{warehouse.isActive ? "Aktiv" : "Inaktiv"}</StatusBadge></td>
                  <td><Link className="textLink" href={`/admin/logistics/warehouses/${warehouse.id}`}>Öffnen</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Offene und erwartete Wareneingänge" description="Sendungen nach Status, Typ und zuständigem Lager.">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Auftrag</th><th>Typ</th><th>Status</th><th>Lager</th><th>Tracking</th></tr></thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.order.orderNumber}</td>
                  <td>{shipment.shipmentType}</td>
                  <td><StatusBadge tone={shipment.status === "DAMAGED" ? "danger" : shipment.status === "RECEIVED" ? "success" : "warning"}>{shipment.status}</StatusBadge></td>
                  <td>{shipment.warehouse.name}</td>
                  <td>{shipment.trackingNumber ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Umlagerungen und Inventur" description="Aktuelle Umlagerungen und Bestände mit Differenzen.">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Typ</th><th>Referenz</th><th>Status/Differenz</th><th>Route/Lager</th></tr></thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>Umlagerung</td>
                  <td>{transfer.inventory.order.orderNumber}</td>
                  <td>{transfer.status}</td>
                  <td>{transfer.fromWarehouse.name} {"->"} {transfer.toWarehouse.name}</td>
                </tr>
              ))}
              {stockCounts.map((count) => (
                <tr key={count.id}>
                  <td>Inventur</td>
                  <td>{count.inventory.order.orderNumber}</td>
                  <td>{count.difference}</td>
                  <td>{count.warehouse.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
