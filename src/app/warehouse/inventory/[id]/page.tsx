import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { PrintButton } from "./PrintButton";
import { requireRole } from "@/lib/auth";
import { REMAINING_STOCK_STATUS_LABELS, WAREHOUSE_INVENTORY_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { inventoryScopeForUser, warehouseScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WarehouseInventoryDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF]);
  const { id } = await params;
  const [inventory, locations] = await Promise.all([
    prisma.warehouseInventory.findFirst({
      where: { id, ...inventoryScopeForUser(session) },
      include: {
        order: { include: { customer: true } },
        warehouseLocation: { include: { warehouse: true } },
        history: { include: { user: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.warehouseLocation.findMany({ where: { warehouse: warehouseScopeForUser(session) }, include: { warehouse: true }, orderBy: { fullLabel: "asc" } }),
  ]);

  if (!inventory) {
    notFound();
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Lagerbestand</p>
          <h1>{inventory.order.orderNumber}</h1>
          <span className="badge">{WAREHOUSE_INVENTORY_STATUS_LABELS[inventory.status]}</span>
        </div>
        <nav className="nav">
          <Link href="/warehouse/dashboard">Dashboard</Link>
          <Link href="/warehouse/inventory">Bestand</Link>
          <Link href="/warehouse/checkin">Wareneingang</Link>
          <Link href="/warehouse/shipments">Lieferungen</Link>
        </nav>
      </header>

      <section className="detailGrid">
        <article className="panel stack">
          <h2 className="sectionTitle">QR-Code</h2>
          {inventory.qrCodePngDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR-Codes werden als Data-URL gespeichert.
            <img className="qrImage" src={inventory.qrCodePngDataUrl} alt={`QR-Code für ${inventory.order.orderNumber}`} />
          ) : (
            <p className="notice">Noch kein QR-Code vorhanden.</p>
          )}
          <div className="actions">
            {inventory.qrCodePngDataUrl ? (
              <a href={inventory.qrCodePngDataUrl} download={`${inventory.order.orderNumber}-qr.png`}>PNG herunterladen</a>
            ) : null}
            <PrintButton />
          </div>
          <form action="/api/warehouse/qrcode" method="post">
            <input type="hidden" name="inventoryId" value={inventory.id} />
            <button type="submit">QR-Code neu erzeugen</button>
          </form>
        </article>

        <article className="panel stack">
          <h2 className="sectionTitle">Bestandsdaten</h2>
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Kunde</th><td>{inventory.order.customer.companyName}</td></tr>
                <tr><th>Stadt</th><td>{inventory.order.city}</td></tr>
                <tr><th>Lagerplatz</th><td>{inventory.warehouseLocation ? `${inventory.warehouseLocation.warehouse.name} / ${inventory.warehouseLocation.fullLabel}` : "-"}</td></tr>
                <tr><th>Erwartet</th><td>{inventory.expectedFlyers}</td></tr>
                <tr><th>Erhalten</th><td>{inventory.receivedFlyers ?? "-"}</td></tr>
                <tr><th>Rest</th><td>{inventory.remainingFlyers ?? "-"} / {REMAINING_STOCK_STATUS_LABELS[inventory.remainingStockStatus]}</td></tr>
                <tr><th>Abholung</th><td>{inventory.pickupStatus}</td></tr>
              </tbody>
            </table>
          </div>

          <form className="form grid" action="/api/warehouse/location" method="post">
            <input type="hidden" name="inventoryId" value={inventory.id} />
            <label className="full">
              Lagerplatz aendern
              <select name="warehouseLocationId" defaultValue={inventory.warehouseLocationId ?? ""} required>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.warehouse.name} / {location.fullLabel}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Platz speichern</button>
          </form>

          <form className="form grid" action="/api/warehouse/status" method="post">
            <input type="hidden" name="inventoryId" value={inventory.id} />
            <label>
              Status
              <select name="status" defaultValue={inventory.status}>
                {Object.entries(WAREHOUSE_INVENTORY_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Rest-Flyer
              <input name="remainingFlyers" type="number" min="0" defaultValue={inventory.remainingFlyers ?? undefined} />
            </label>
            <label>
              Restbestand
              <select name="remainingStockStatus" defaultValue={inventory.remainingStockStatus}>
                {Object.entries(REMAINING_STOCK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="full">
              Notiz
              <textarea name="notes" defaultValue={inventory.notes ?? ""} />
            </label>
            <button type="submit">Status speichern</button>
          </form>
        </article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Historie</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Zeitpunkt</th><th>Aktion</th><th>Benutzer</th></tr></thead>
            <tbody>
              {inventory.history.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.action}</td>
                  <td>{entry.user?.email ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

