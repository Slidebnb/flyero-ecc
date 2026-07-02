import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { warehouseScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

export default async function WarehouseLocationsPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF]);
  const warehouseScope = warehouseScopeForUser(session);

  const [warehouses, locations] = await Promise.all([
    prisma.warehouse.findMany({ where: warehouseScope, orderBy: { name: "asc" } }),
    prisma.warehouseLocation.findMany({
      where: { warehouse: warehouseScope },
      include: { warehouse: true, inventories: true },
      orderBy: [{ warehouseId: "asc" }, { fullLabel: "asc" }],
    }),
  ]);

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lager</p>
          <h1>Regalplaetze</h1>
        </div>
        <nav className="nav">
          <Link href="/warehouse/dashboard">Dashboard</Link>
          <Link href="/warehouse/checkin">Wareneingang</Link>
          <Link href="/warehouse/shipments">Lieferungen</Link>
          <Link href="/warehouse/transfers">Umlagerungen</Link>
          <Link href="/warehouse/stock-counts">Inventur</Link>
          <Link href="/warehouse/inventory">Bestand</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Neuen Lagerplatz anlegen</h2>
        <form className="form grid" action="/api/warehouse/locations" method="post">
          <label>
            Lager
            <select name="warehouseId" required>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </label>
          <label>
            Gang
            <input name="aisle" placeholder="A" required />
          </label>
          <label>
            Regal
            <input name="shelf" placeholder="01" required />
          </label>
          <label>
            Fach
            <input name="compartment" placeholder="02" required />
          </label>
          <button type="submit">Lagerplatz anlegen</button>
        </form>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Vorhandene Plaetze</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Lager</th><th>Platz</th><th>Belegt durch</th></tr></thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location.id}>
                  <td>{location.warehouse.name}</td>
                  <td>{location.fullLabel}</td>
                  <td>{location.inventories.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
