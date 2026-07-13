import Link from "next/link";
import { UserRole, WarehouseInventoryStatus } from "@prisma/client";
import { EmptyState } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { REMAINING_STOCK_STATUS_LABELS, WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { warehouseLocationSelect, warehouseOrderSelect } from "@/lib/warehousePrivacy";

type PageProps = {
  searchParams: Promise<{ status?: string; search?: string; city?: string; location?: string }>;
};

export default async function WarehouseInventoryPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF]);
  const params = await searchParams;
  const status = Object.values(WarehouseInventoryStatus).includes(params.status as WarehouseInventoryStatus)
    ? (params.status as WarehouseInventoryStatus)
    : undefined;

  const inventory = await prisma.warehouseInventory.findMany({
    where: {
      ...inventoryScopeForUser(session),
      ...(status ? { status } : {}),
      ...(params.city ? { order: { city: { contains: params.city, mode: "insensitive" } } } : {}),
      ...(params.location ? { warehouseLocation: { fullLabel: { contains: params.location, mode: "insensitive" } } } : {}),
      ...(params.search
        ? {
              OR: [
                { order: { orderNumber: { contains: params.search, mode: "insensitive" } } },
              { qrCode: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      remainingStockStatus: true,
      remainingFlyers: true,
      expectedFlyers: true,
      order: { select: warehouseOrderSelect },
      warehouseLocation: { select: warehouseLocationSelect },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lager</p>
          <h1>Lagerbestand</h1>
        </div>
        <nav className="nav">
          <Link href="/warehouse/dashboard">Dashboard</Link>
          <Link href="/warehouse/checkin">Wareneingang</Link>
          <Link href="/warehouse/shipments">Lieferungen</Link>
          <Link href="/warehouse/transfers">Umlagerungen</Link>
          <Link href="/warehouse/stock-counts">Inventur</Link>
          <Link href="/warehouse/locations">Regalplaetze</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <form className="form grid" method="get">
          <label>
            Suche
            <input name="search" defaultValue={params.search} placeholder="Auftrag, Kunde oder QR" />
          </label>
          <label>
            Stadt
            <input name="city" defaultValue={params.city} placeholder="Koblenz" />
          </label>
          <label>
            Platz
            <input name="location" defaultValue={params.location} placeholder="A-01-02" />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Alle</option>
              {Object.entries(WAREHOUSE_INVENTORY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr><th>Auftrag</th><th>Ort</th><th>Status</th><th>Platz</th><th>Rest</th><th></th></tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.order.orderNumber}</td>
                  <td>{item.order.city}</td>
                  <td>{WAREHOUSE_INVENTORY_STATUS_LABELS[item.status]}</td>
                  <td>{item.warehouseLocation?.fullLabel ?? "-"}</td>
                  <td>{item.remainingFlyers ?? item.expectedFlyers} / {REMAINING_STOCK_STATUS_LABELS[item.remainingStockStatus]}</td>
                  <td><Link className="textLink" href={`/warehouse/inventory/${item.id}`}>Details</Link></td>
                </tr>
              ))}
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Keine passenden Lagerbestände gefunden."
                      description="Passe die Filter an oder öffne den Wareneingang, wenn neue Flyer angekommen sind."
                      action={{ href: "/warehouse/checkin", label: "Wareneingang öffnen" }}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
