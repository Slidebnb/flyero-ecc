import Link from "next/link";
import { Prisma, UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productionCustomerWhere } from "@/lib/productionData";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  await requireRole([UserRole.ADMIN]);
  const params = await searchParams;
  const query = (params.q || "").trim();

  const where: Prisma.CustomerProfileWhereInput = {
    ...productionCustomerWhere(),
    ...(query
      ? {
          OR: [
            { companyName: { contains: query, mode: "insensitive" } },
            { contactName: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [customers, totalCustomers, verifiedUsers] = await Promise.all([
    prisma.customerProfile.findMany({
      where,
      include: {
        user: { select: { email: true, status: true, emailVerified: true, createdAt: true } },
        _count: { select: { orders: true, invoices: true, documents: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customerProfile.count({ where: productionCustomerWhere() }),
    prisma.customerProfile.count({ where: { ...productionCustomerWhere(), user: { emailVerified: { not: null } } } }),
  ]);

  return (
    <AdminPortalShell
      title="Kunden"
      description="Registrierte Kunden finden, Kundenprofil oeffnen und freigegebene Rechnungen oder Nachweise zuordnen."
    >
      <section className="portalMetrics">
        <MetricTile label="Kunden gesamt" value={totalCustomers} />
        <MetricTile label="E-Mail bestaetigt" value={verifiedUsers} tone="success" />
        <MetricTile label="Aktuelle Treffer" value={customers.length} />
      </section>

      <DataSection title="Kunden suchen" description="Suche nach Unternehmen, Kontakt, Telefon oder E-Mail.">
        <form className="form grid" action="/admin/customers" method="get">
          <label>
            Suche
            <input name="q" defaultValue={query} placeholder="Firma, Kontakt oder E-Mail" />
          </label>
          <button type="submit">Suchen</button>
        </form>
      </DataSection>

      <DataSection title="Kundenliste" description="Neue Kunden stehen oben. Das Profil enthält Aufträge, Rechnungen und Nachweise.">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Kunde</th>
                <th>E-Mail</th>
                <th>Status</th>
                <th>Registriert</th>
                <th>Aufträge</th>
                <th>Unterlagen</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong>{customer.companyName}</strong>
                    <small className="muted" style={{ display: "block" }}>{customer.contactName || "Kein Kontaktname"}</small>
                  </td>
                  <td>{customer.user.email}</td>
                  <td>
                    <StatusBadge tone={customer.user.emailVerified ? "success" : "warning"}>
                      {customer.user.emailVerified ? "Bestätigt" : "E-Mail offen"}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(customer.createdAt)}</td>
                  <td>{customer._count.orders}</td>
                  <td>{customer._count.invoices + customer._count.documents}</td>
                  <td>
                    <Link className="textLink" href={`/admin/customers/${customer.id}`}>Profil oeffnen</Link>
                  </td>
                </tr>
              ))}
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="Keine Kunden gefunden." description="Passe den Suchbegriff an oder pruefe neue Registrierungen spaeter erneut." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
