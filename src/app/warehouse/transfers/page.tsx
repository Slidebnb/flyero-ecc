import { TransferStatus, UserRole } from "@prisma/client";
import { DataSection, EmptyState, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { transferScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { warehouseOrderSelect, warehouseSelect } from "@/lib/warehousePrivacy";

export default async function WarehouseTransfersPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const transfers = await prisma.warehouseTransfer.findMany({
    where: transferScopeForUser(session),
    select: {
      id: true,
      status: true,
      quantity: true,
      fromWarehouse: { select: warehouseSelect },
      toWarehouse: { select: warehouseSelect },
      inventory: { select: { order: { select: warehouseOrderSelect } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <PortalShell eyebrow="Lager" title="Umlagerungen" description="Umlagerungen verfolgen und eintreffende Bestände übernehmen." navItems={[
      { href: "/warehouse/dashboard", label: "Dashboard" },
      { href: "/warehouse/shipments", label: "Lieferungen" },
      { href: "/warehouse/transfers", label: "Umlagerungen" },
      { href: "/warehouse/stock-counts", label: "Inventur" },
      { href: "/warehouse/inventory", label: "Bestand" },
    ]}>
      <DataSection title="Umlagerungen">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Auftrag</th><th>Von</th><th>Nach</th><th>Menge</th><th>Status</th><th>Aktion</th></tr></thead>
            <tbody>
              {transfers.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{transfer.inventory.order.orderNumber}</td>
                  <td>{transfer.fromWarehouse.name}</td>
                  <td>{transfer.toWarehouse.name}</td>
                  <td>{transfer.quantity}</td>
                  <td><StatusBadge tone={transfer.status === "RECEIVED" ? "success" : "warning"}>{transfer.status}</StatusBadge></td>
                  <td>
                    <form className="inlineForm" action={`/api/warehouse/transfers/${transfer.id}`} method="post">
                      <select name="status" defaultValue={transfer.status}>
                        {Object.values(TransferStatus).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <button type="submit">Speichern</button>
                    </form>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Keine Umlagerungen für dieses Lager."
                      description="Sobald Ware zwischen Lagern bewegt wird, erscheinen Status und Übernahme hier."
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
