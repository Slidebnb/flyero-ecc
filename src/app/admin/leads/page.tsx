import { LeadStatus, LeadType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { leadScopeFromSession, leadScopeWhere } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
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

  const session = await requirePermission(Permission.CRM_MANAGE);
  const id = String(formData.get("id") || "");
  await updateLead(
    id,
    {
      status: String(formData.get("status") || "") as LeadStatus,
      adminNote: String(formData.get("adminNote") || ""),
      archive: formData.get("archive") === "true",
    },
    session.id,
    leadScopeFromSession(session),
  );
  revalidatePath("/admin/leads");
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePermission(Permission.CRM_VIEW);
  const params = await searchParams;
  const status = params.status && Object.values(LeadStatus).includes(params.status as LeadStatus) ? params.status as LeadStatus : undefined;
  const type = params.type && Object.values(LeadType).includes(params.type as LeadType) ? params.type as LeadType : undefined;
  const archived = params.archived || "false";
  const search = params.search?.trim();

  const leads = await prisma.lead.findMany({
      where: {
        ...leadScopeWhere(leadScopeFromSession(session)),
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
    <AdminPortalShell
      title="Leads"
      description="Anfragen aus Landingpage, Kontaktformular und Verteilungsanfrage sauber qualifizieren."
    >
      <DataSection title="Filter" description="Neue, aktive, archivierte oder thematisch passende Leads schnell eingrenzen.">
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
      </DataSection>

      <DataSection title="Lead-Liste">
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
                    <StatusBadge>{lead.type}</StatusBadge>
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
                  <td colSpan={4}><EmptyState title="Keine Leads für diesen Filter." description="Passe Status, Typ, Archiv oder Suchbegriff an." /></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </AdminPortalShell>
  );
}
