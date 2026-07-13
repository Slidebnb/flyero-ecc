import Link from "next/link";
import { LeadPriority, LeadStatus, LeadType } from "@prisma/client";
import { redirect } from "next/navigation";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { getAssignableUsers, listCrmLeads, parseLeadListFilters, updateCrmLead } from "@/lib/crm";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

type CrmPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Neu",
  CONTACTED: "Kontaktiert",
  QUALIFIED: "Qualifiziert",
  OFFER_SENT: "Angebot gesendet",
  TEST_ORDER_PLANNED: "Testauftrag geplant",
  WON: "Gewonnen",
  LOST: "Verloren",
  ARCHIVED: "Archiviert",
};

const PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

function badgeTone(status: LeadStatus) {
  if (status === "WON") return "success" as const;
  if (status === "LOST" || status === "ARCHIVED") return "danger" as const;
  if (status === "NEW" || status === "OFFER_SENT" || status === "TEST_ORDER_PLANNED") return "warning" as const;
  return "neutral" as const;
}

async function updateLeadFromList(formData: FormData) {
  "use server";
  const session = await requirePermission(Permission.CRM_MANAGE);
  const id = String(formData.get("id") || "");
  if (!id) return;
  await updateCrmLead(id, {
    status: String(formData.get("status") || "") as LeadStatus,
    priority: String(formData.get("priority") || "") as LeadPriority,
    assignedToId: String(formData.get("assignedToId") || "") || null,
    nextFollowUpAt: String(formData.get("nextFollowUpAt") || "") || null,
  }, session.id, leadScopeFromSession(session));
  redirect("/admin/crm");
}

export default async function AdminCrmPage({ searchParams }: CrmPageProps) {
  const session = await requirePermission(Permission.CRM_VIEW);
  const params = await searchParams;
  const filters = parseLeadListFilters(params ?? {});
  const scope = leadScopeFromSession(session);
  const [leads, users] = await Promise.all([listCrmLeads(filters, scope), getAssignableUsers(scope)]);
  const openLeads = leads.filter((lead) => !["WON", "LOST", "ARCHIVED"].includes(lead.status));
  const urgent = leads.filter((lead) => lead.priority === "URGENT" || lead.priority === "HIGH").length;
  const due = leads.filter((lead) => lead.nextFollowUpAt && lead.nextFollowUpAt <= new Date()).length;
  const won = leads.filter((lead) => lead.status === "WON").length;
  const kanbanStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "OFFER_SENT", "TEST_ORDER_PLANNED", "WON", "LOST"];

  return (
    <PortalShell
      eyebrow="CRM"
      title="Leadpipeline"
      description="Interessenten aus Landingpage, Kontaktformular und Vertrieb sauber qualifizieren, nachfassen und in Kunden umwandeln."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Leads im Filter" value={leads.length} />
        <MetricTile label="Offene Pipeline" value={openLeads.length} tone="warning" />
        <MetricTile label="Hohe Priorität" value={urgent} tone={urgent ? "warning" : "neutral"} />
        <MetricTile label="Follow-up fällig" value={due} tone={due ? "danger" : "neutral"} />
        <MetricTile label="Gewonnen" value={won} tone="success" />
      </section>

      <ActionPanel title="Lead suchen und filtern" description="Status, Priorität, Stadt, Typ oder Volltext eingrenzen.">
        <form className="form analyticsFilterGrid" action="/admin/crm">
          <label>Suche<input name="search" defaultValue={filters.search ?? ""} placeholder="Name, Firma, E-Mail" /></label>
          <label>Status<select name="status" defaultValue={filters.status ?? ""}>
            <option value="">Alle</option>
            {Object.values(LeadStatus).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select></label>
          <label>Priorität<select name="priority" defaultValue={filters.priority ?? ""}>
            <option value="">Alle</option>
            {Object.values(LeadPriority).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
          </select></label>
          <label>Stadt<input name="city" defaultValue={filters.city ?? ""} placeholder="Koblenz" /></label>
          <label>Typ<select name="type" defaultValue={filters.type ?? ""}>
            <option value="">Alle</option>
            {Object.values(LeadType).map((type) => <option key={type} value={type}>{type}</option>)}
          </select></label>
          <label>Archiv<select name="archived" defaultValue={filters.archived ?? "false"}>
            <option value="false">Aktive</option>
            <option value="true">Archivierte</option>
            <option value="all">Alle</option>
          </select></label>
          <button type="submit">Filtern</button>
        </form>
      </ActionPanel>

      <DataSection title="Kanban" description="Schneller Blick auf die Lead-Stufen.">
        <div className="crmKanban">
          {kanbanStatuses.map((status) => (
            <section key={status}>
              <h3>{STATUS_LABELS[status]}</h3>
              {leads.filter((lead) => lead.status === status).slice(0, 8).map((lead) => (
                <Link href={`/admin/crm/leads/${lead.id}`} className="crmLeadCard" key={lead.id}>
                  <strong>{lead.companyName || lead.name}</strong>
                  <span>{lead.city || "Ort offen"} / {PRIORITY_LABELS[lead.priority]}</span>
                  <small>{lead.nextFollowUpAt ? new Intl.DateTimeFormat("de-DE").format(lead.nextFollowUpAt) : "kein Follow-up"}</small>
                </Link>
              ))}
            </section>
          ))}
        </div>
      </DataSection>

      <DataSection title="Listenansicht" description="Direkt bearbeiten oder Lead im Detail öffnen.">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Status</th>
                <th>Priorität</th>
                <th>Verantwortlich</th>
                <th>Follow-up</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.companyName || lead.name}</strong><br />
                    <span className="muted">{lead.email} / {lead.city || "Ort offen"}</span><br />
                    <Link className="textLink" href={`/admin/crm/leads/${lead.id}`}>Lead öffnen</Link>
                  </td>
                  <td><StatusBadge tone={badgeTone(lead.status)}>{STATUS_LABELS[lead.status]}</StatusBadge></td>
                  <td>{PRIORITY_LABELS[lead.priority]}</td>
                  <td>{lead.assignedTo?.email ?? "offen"}</td>
                  <td>{lead.nextFollowUpAt ? new Intl.DateTimeFormat("de-DE").format(lead.nextFollowUpAt) : "offen"}</td>
                  <td>
                    <form action={updateLeadFromList} className="inlineLeadForm">
                      <input type="hidden" name="id" value={lead.id} />
                      <select name="status" defaultValue={lead.status}>{Object.values(LeadStatus).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
                      <select name="priority" defaultValue={lead.priority}>{Object.values(LeadPriority).map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select>
                      <select name="assignedToId" defaultValue={lead.assignedToId ?? ""}>
                        <option value="">Niemand</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                      </select>
                      <input name="nextFollowUpAt" type="datetime-local" defaultValue={lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString().slice(0, 16) : ""} />
                      <button type="submit">Speichern</button>
                    </form>
                  </td>
                </tr>
              ))}
              {leads.length === 0 ? <tr><td colSpan={6}><EmptyState title="Keine Leads gefunden." description="Passe die Filter an oder prüfe neue Landingpage-Anfragen." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
