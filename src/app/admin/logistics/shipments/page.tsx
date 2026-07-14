import { ShipmentStatus, ShipmentType, UserRole } from "@prisma/client";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";
import { warehouseSourceWhere } from "@/lib/warehouse";
import { productionOrderWhere } from "@/lib/productionData";

type PageProps = { searchParams?: Promise<Record<string, string | undefined>> };

export default async function AdminLogisticsShipmentsPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const tenantId = session.role === UserRole.ADMIN ? undefined : session.tenantId;
  const params = (await searchParams) ?? {};
  const status = Object.values(ShipmentStatus).includes(params.status as ShipmentStatus) ? (params.status as ShipmentStatus) : undefined;
  const shipmentType = Object.values(ShipmentType).includes(params.type as ShipmentType) ? (params.type as ShipmentType) : undefined;
  const [shipments, warehouses, orders] = await Promise.all([
    prisma.logisticsShipment.findMany({
      where: {
        order: { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) },
        ...(status ? { status } : {}),
        ...(shipmentType ? { shipmentType } : {}),
        ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}),
      },
      include: {
        order: { include: { customer: { select: { id: true, companyName: true, userId: true } } } },
        warehouse: true,
        printOrder: true,
      },
      orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.warehouse.findMany({ where: { isActive: true, ...warehouseSourceWhere() }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { ...productionOrderWhere(), ...(tenantId === undefined ? {} : { tenantId: tenantId ?? "__no_tenant__" }) },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, orderNumber: true, targetAreaName: true },
    }),
  ]);
  return (
    <PortalShell eyebrow="Admin Logistik" title="Sendungsverwaltung" description="Sendungen filtern, anlegen und Status zentral pflegen." navItems={adminNavItems}>
      <DataSection title="Sendung anlegen">
        <form className="form grid" action="/api/admin/logistics/shipments" method="post">
          <label>Auftrag<select name="orderId" required>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} / {order.targetAreaName}</option>)}</select></label>
          <label>Lager<select name="warehouseId" required>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
          <label>Typ<select name="shipmentType" defaultValue="CUSTOMER_TO_WAREHOUSE">{Object.values(ShipmentType).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
          <label>Carrier<input name="carrier" /></label>
          <label>Trackingnummer<input name="trackingNumber" /></label>
          <label>Erwartet am<input name="expectedDeliveryDate" type="date" /></label>
          <label>Notizen<textarea name="notes" /></label>
          <button type="submit">Sendung anlegen</button>
        </form>
      </DataSection>
      <DataSection title="Sendungen">
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Kunde</th><th>Typ</th><th>Status</th><th>Lager</th><th>Tracking</th><th>Aktion</th></tr></thead><tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id}>
              <td>{shipment.order.orderNumber}</td><td>{shipment.order.customer.companyName}</td><td>{shipment.shipmentType}</td>
              <td><StatusBadge tone={shipment.status === "DAMAGED" ? "danger" : shipment.status === "RECEIVED" ? "success" : "warning"}>{shipment.status}</StatusBadge></td>
              <td>{shipment.warehouse.name}</td><td>{shipment.trackingNumber ?? "-"}</td>
              <td>
                <form action={`/api/admin/logistics/shipments/${shipment.id}`} method="post" className="inlineForm">
                  <input type="hidden" name="status" value={shipment.status === "DAMAGED" ? "RECEIVED" : "DAMAGED"} />
                  <button type="submit">{shipment.status === "DAMAGED" ? "Als erhalten" : "Beschädigt"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
