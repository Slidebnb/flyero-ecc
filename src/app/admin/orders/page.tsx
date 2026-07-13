import Link from "next/link";
import { OrderStatus, UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { ADMIN_ORDER_STATUS_OPTIONS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { getOrderGrossPrice } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ status?: string; search?: string; city?: string }>;
};

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const params = await searchParams;
  const status = ADMIN_ORDER_STATUS_OPTIONS.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(params.city ? { city: { contains: params.city, mode: "insensitive" } } : {}),
      ...(params.search
        ? {
            OR: [
              { orderNumber: { contains: params.search, mode: "insensitive" } },
              { targetAreaName: { contains: params.search, mode: "insensitive" } },
              { customer: { companyName: { contains: params.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminPortalShell
      title="Alle Aufträge"
      description="Aufträge filtern, prüfen und ohne Seitenwechsel in die Detailbearbeitung springen."
    >
      <DataSection title="Filter" description="Suche nach Auftrag, Kunde, Gebiet, Stadt oder Status.">
        <form className="form grid" action="/admin/orders" method="get">
          <label>
            Suche
            <input name="search" defaultValue={params.search || ""} />
          </label>
          <label>
            Stadt
            <input name="city" defaultValue={params.city || ""} />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status || ""}>
              <option value="">Alle</option>
              {ADMIN_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {ORDER_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <DataSection title="Auftragsliste">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Auftrag</th>
                <th>Kunde</th>
                <th>Status</th>
                <th>Stadt</th>
                <th>Datum</th>
                <th>Preis</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.customer.companyName}</td>
                  <td><StatusBadge>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></td>
                  <td>{order.city}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>{formatCurrency(getOrderGrossPrice(order))}</td>
                  <td>
                    <Link className="textLink" href={`/admin/orders/${order.id}`}>
                      Öffnen
                    </Link>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7}><EmptyState title="Keine Aufträge gefunden." description="Passe Filter oder Suchbegriff an." /></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
