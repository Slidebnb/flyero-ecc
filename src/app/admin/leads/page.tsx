import { LeadStatus, LeadType, UserRole } from "@prisma/client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { updateLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
  status?: string;
  type?: string;
  archived?: string;
  search?: string;
}>;

async function updateLeadAction(formData: FormData) {
  "use server";

  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const id = String(formData.get("id") || "");
  await updateLead(
    id,
    {
      status: String(formData.get("status") || "") as LeadStatus,
      adminNote: String(formData.get("adminNote") || ""),
      archive: formData.get("archive") === "true",
    },
    session.id,
  );
  revalidatePath("/admin/leads");
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const params = await searchParams;
  const status = params.status && Object.values(LeadStatus).includes(params.status as LeadStatus) ? params.status as LeadStatus : undefined;
  const type = params.type && Object.values(LeadType).includes(params.type as LeadType) ? params.type as LeadType : undefined;
  const archived = params.archived || "false";
  const search = params.search?.trim();

  const leads = await prisma.lead.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(archived === "true" ? { archivedAt: { not: null } } : archived === "all" ? {} : { archivedAt: null }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adminbereich</p>
          <h1>Leads</h1>
          <p className="muted">Anfragen aus Landingpage und Kontaktformular.</p>
        </div>
        <nav className="nav">
          <Link href="/admin/dashboard">Dashboard</Link>
          <Link href="/admin/orders">Auftraege</Link>
          <Link href="/admin/settings">Einstellungen</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Abmelden</button>
          </form>
        </nav>
      </header>

      <section className="panel widePanel stack">
        <form className="form grid" method="get">
          <label>
            Status
            <select name="status" defaultValue={status || ""}>
              <option value="">Alle Status</option>
              {Object.values(LeadStatus).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Typ
            <select name="type" defaultValue={type || ""}>
              <option value="">Alle Typen</option>
              {Object.values(LeadType).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Archiv
            <select name="archived" defaultValue={archived}>
              <option value="false">Aktive Leads</option>
              <option value="true">Archivierte Leads</option>
              <option value="all">Alle Leads</option>
            </select>
          </label>
          <label>
            Suche
            <input name="search" defaultValue={search || ""} placeholder="Name, Firma, E-Mail oder Stadt" />
          </label>
          <button type="submit">Filtern</button>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Interesse</th>
                <th>Nachricht</th>
                <th>Status / Notiz</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.name}</strong>
                    <br />
                    <span>{lead.companyName || "Keine Firma"}</span>
                    <br />
                    <a className="textLink" href={`mailto:${lead.email}`}>{lead.email}</a>
                    <br />
                    <span>{lead.phone || "Keine Telefonnummer"}</span>
                    <br />
                    <span>{lead.city || "Keine Stadt"}</span>
                    <br />
                    <small>{lead.createdAt.toLocaleString("de-DE")} / {lead.source}</small>
                  </td>
                  <td>
                    <span className="badge">{lead.type}</span>
                    {lead.archivedAt ? <p className="muted">Archiviert</p> : null}
                  </td>
                  <td>{lead.message}</td>
                  <td>
                    <form className="inlineLeadForm" action={updateLeadAction}>
                      <input type="hidden" name="id" value={lead.id} />
                      <label>
                        Status
                        <select name="status" defaultValue={lead.status}>
                          {Object.values(LeadStatus).map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Notiz
                        <textarea name="adminNote" defaultValue={lead.adminNote || ""} />
                      </label>
                      {lead.archivedAt ? (
                        <button type="submit" name="archive" value="false">Reaktivieren</button>
                      ) : (
                        <div className="leadActionRow">
                          <button type="submit" name="archive" value="false">Speichern</button>
                          <button type="submit" name="archive" value="true">Archivieren</button>
                        </div>
                      )}
                    </form>
                  </td>
                </tr>
              ))}
              {!leads.length ? (
                <tr>
                  <td colSpan={4}>Keine Leads fuer diesen Filter.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
