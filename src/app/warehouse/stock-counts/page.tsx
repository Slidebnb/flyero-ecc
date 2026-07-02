import { UserRole } from "@prisma/client";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

export default async function WarehouseStockCountsPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const [inventory, counts, warehouses] = await Promise.all([
    prisma.warehouseInventory.findMany({
      where: inventoryScopeForUser(session),
      include: { order: true, warehouse: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.warehouseStockCount.findMany({
      where: session.role === UserRole.WAREHOUSE_STAFF ? { warehouseId: session.warehouseId || "__none__" } : {},
      include: { warehouse: true, inventory: { include: { order: true } }, countedBy: true },
      orderBy: { countedAt: "desc" },
      take: 100,
    }),
    prisma.warehouse.findMany({ where: session.role === UserRole.WAREHOUSE_STAFF ? { id: session.warehouseId || "__none__" } : {}, orderBy: { name: "asc" } }),
  ]);

  return (
    <PortalShell eyebrow="Lager" title="Inventur" description="Bestände zählen, Differenzen dokumentieren und spätere Klärung vorbereiten." navItems={[
      { href: "/warehouse/dashboard", label: "Dashboard" },
      { href: "/warehouse/shipments", label: "Lieferungen" },
      { href: "/warehouse/transfers", label: "Umlagerungen" },
      { href: "/warehouse/stock-counts", label: "Inventur" },
      { href: "/warehouse/inventory", label: "Bestand" },
    ]}>
      <DataSection title="Neue Zählung">
        <form className="form grid" action="/api/warehouse/stock-counts" method="post">
          <label>Lager<select name="warehouseId" required>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label>
          <label>Bestand<select name="inventoryId" required>{inventory.map((item) => <option key={item.id} value={item.id}>{item.order.orderNumber} / {item.remainingFlyers ?? item.expectedFlyers} Flyer</option>)}</select></label>
          <label>Erwartet<input name="expectedQuantity" type="number" min="0" required /></label>
          <label>Gezählt<input name="countedQuantity" type="number" min="0" required /></label>
          <label>Notizen<textarea name="notes" /></label>
          <button type="submit">Inventur speichern</button>
        </form>
      </DataSection>
      <DataSection title="Letzte Inventuren">
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Lager</th><th>Erwartet</th><th>Gezählt</th><th>Differenz</th></tr></thead><tbody>
          {counts.map((count) => <tr key={count.id}><td>{count.inventory.order.orderNumber}</td><td>{count.warehouse.name}</td><td>{count.expectedQuantity}</td><td>{count.countedQuantity}</td><td><StatusBadge tone={count.difference === 0 ? "success" : "warning"}>{count.difference}</StatusBadge></td></tr>)}
          {counts.length === 0 ? <tr><td colSpan={5}>Noch keine Inventur erfasst.</td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
