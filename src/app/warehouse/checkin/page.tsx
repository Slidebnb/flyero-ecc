import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { warehouseScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

export default async function WarehouseCheckinPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF]);
  const warehouseScope = warehouseScopeForUser(session);

  const [warehouses, locations, orders] = await Promise.all([
    prisma.warehouse.findMany({ where: warehouseScope, orderBy: { name: "asc" } }),
    prisma.warehouseLocation.findMany({ where: { warehouse: warehouseScope }, include: { warehouse: true }, orderBy: { fullLabel: "asc" } }),
    prisma.order.findMany({
      where: {
        OR: [
          { status: { in: ["APPROVED", "READY_FOR_FLYERS", "FLYERS_EXPECTED"] } },
          { warehouseInventory: { status: "FLYERS_EXPECTED" } },
        ],
      },
      include: { customer: true, warehouseInventory: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lager</p>
          <h1>Wareneingang</h1>
        </div>
        <nav className="nav">
          <Link href="/warehouse/dashboard">Dashboard</Link>
          <Link href="/warehouse/shipments">Lieferungen</Link>
          <Link href="/warehouse/transfers">Umlagerungen</Link>
          <Link href="/warehouse/stock-counts">Inventur</Link>
          <Link href="/warehouse/inventory">Bestand</Link>
          <Link href="/warehouse/locations">Regalplaetze</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Flyer annehmen und einlagern</h2>
        <form className="form grid" action="/api/warehouse/checkin" method="post">
          <label>
            Auftrag
            <select name="orderId" required>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} - {order.customer.companyName} - {ORDER_STATUS_LABELS[order.status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lager
            <select name="warehouseId" required>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <label>
            Lagerplatz
            <select name="warehouseLocationId" required>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.warehouse.name} / {location.fullLabel}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kartons
            <input name="cartonCount" type="number" min="1" defaultValue="1" required />
          </label>
          <label>
            Erhaltene Flyer
            <input name="receivedFlyers" type="number" min="0" required />
          </label>
          <label>
            Beschaedigte Flyer
            <input name="damagedFlyers" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Gewicht optional
            <input name="weightOptional" type="number" min="0" step="0.01" />
          </label>
          <label className="full">
            Notiz
            <textarea name="notes" placeholder="Interne Lager-Notiz" />
          </label>
          <button type="submit" disabled={orders.length === 0 || locations.length === 0}>
            Wareneingang buchen
          </button>
        </form>
        {orders.length === 0 || locations.length === 0 ? (
          <p className="notice">Es werden ein freigegebener Auftrag und mindestens ein Lagerplatz benoetigt.</p>
        ) : null}
      </section>
    </main>
  );
}
