import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

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

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Lagerverwaltung</h1>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/orders">Alle Aufträge</Link>
          <Link href="/admin/distributors">Verteilerprüfung</Link>
        </nav>
      </header>

      <section className="gridCards">
        <article className="card"><strong>{warehouses}</strong><span>Lager</span></article>
        <article className="card"><strong>{locations}</strong><span>Regalplaetze</span></article>
        <article className="card"><strong>{inventory.length}</strong><span>Aktive Bestaende</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Lagerbestaende</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Auftrag</th><th>Kunde</th><th>Status</th><th>Platz</th><th>Rest</th></tr></thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td>{item.order.orderNumber}</td>
                  <td>{item.order.customer.companyName}</td>
                  <td>{WAREHOUSE_INVENTORY_STATUS_LABELS[item.status]}</td>
                  <td>{item.warehouseLocation?.fullLabel ?? "-"}</td>
                  <td>{item.remainingFlyers ?? item.expectedFlyers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}



