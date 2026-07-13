import { ShipmentStatus, UserRole } from "@prisma/client";
import { DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { shipmentScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { warehouseOrderSelect, warehouseSelect } from "@/lib/warehousePrivacy";

export default async function WarehouseShipmentsPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const shipments = await prisma.logisticsShipment.findMany({
    where: shipmentScopeForUser(session),
    select: {
      id: true,
      shipmentType: true,
      status: true,
      trackingNumber: true,
      order: { select: warehouseOrderSelect },
      warehouse: { select: warehouseSelect },
    },
    orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <PortalShell eyebrow="Lager" title="Lieferungen" description="Erwartete Lieferungen prüfen, beschädigte Ware melden und Wareneingänge bestätigen." navItems={[
      { href: "/warehouse/dashboard", label: "Dashboard" },
      { href: "/warehouse/checkin", label: "Wareneingang" },
      { href: "/warehouse/shipments", label: "Lieferungen" },
      { href: "/warehouse/transfers", label: "Umlagerungen" },
      { href: "/warehouse/stock-counts", label: "Inventur" },
      { href: "/warehouse/inventory", label: "Bestand" },
    ]}>
      <DataSection title="Erwartete Lieferungen">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Auftrag</th><th>Ort</th><th>Typ</th><th>Status</th><th>Tracking</th><th>Aktion</th></tr></thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id}>
                  <td>{shipment.order.orderNumber}</td>
                  <td>{shipment.order.city}</td>
                  <td>{shipment.shipmentType}</td>
                  <td><StatusBadge tone={shipment.status === "DAMAGED" ? "danger" : shipment.status === "RECEIVED" ? "success" : "warning"}>{shipment.status}</StatusBadge></td>
                  <td>{shipment.trackingNumber ?? "-"}</td>
                  <td>
                    <form className="inlineForm" action={`/api/warehouse/shipments/${shipment.id}`} method="post">
                      <select name="status" defaultValue={shipment.status}>
                        {Object.values(ShipmentStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button type="submit">Speichern</button>
                    </form>
                  </td>
                </tr>
              ))}
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Keine Lieferungen für dieses Lager."
                      description="Sobald Druckware für dein Lager erwartet wird, erscheint sie hier mit Status und Tracking."
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
