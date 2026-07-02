import { TransferStatus, UserRole } from "@prisma/client";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { transferScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";

export default async function WarehouseTransfersPage() {
  const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const transfers = await prisma.warehouseTransfer.findMany({
    where: transferScopeForUser(session),
    include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } } },
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
        <div className="tableWrap"><table><thead><tr><th>Auftrag</th><th>Von</th><th>Nach</th><th>Menge</th><th>Status</th><th>Aktion</th></tr></thead><tbody>
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
          {transfers.length === 0 ? <tr><td colSpan={6}>Keine Umlagerungen für dieses Lager.</td></tr> : null}
        </tbody></table></div>
      </DataSection>
    </PortalShell>
  );
}
