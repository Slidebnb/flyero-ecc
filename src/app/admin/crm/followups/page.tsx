import Link from "next/link";
import { DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { getCrmFollowups } from "@/lib/crm";
import { leadScopeFromSession } from "@/lib/leadScope";
import { Permission, requirePermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

function FollowupList({
  title,
  leads,
  empty,
}: {
  title: string;
  leads: Awaited<ReturnType<typeof getCrmFollowups>>["today"];
  empty: string;
}) {
  return (
    <DataSection title={title}>
      <div className="mobileList">
        {leads.map((lead) => (
          <Link className="mobileListItem" href={`/admin/crm/leads/${lead.id}`} key={lead.id}>
            <strong>{lead.companyName || lead.name}</strong>
            <span>{lead.city || "Ort offen"} / {lead.assignedTo?.email ?? "nicht zugewiesen"}</span>
            <small>{lead.nextFollowUpAt ? formatDateTime(lead.nextFollowUpAt) : "kein Datum"}</small>
            <StatusBadge tone={lead.priority === "URGENT" || lead.priority === "HIGH" ? "warning" : "neutral"}>{lead.priority}</StatusBadge>
          </Link>
        ))}
        {leads.length === 0 ? <EmptyState title={empty} /> : null}
      </div>
    </DataSection>
  );
}

export default async function CrmFollowupsPage() {
  const session = await requirePermission(Permission.CRM_VIEW);
  const followups = await getCrmFollowups(leadScopeFromSession(session));

  return (
    <PortalShell
      eyebrow="CRM"
      title="Follow-ups"
      description="Heute fällige, überfällige und unvollständige Lead-Nachfassaktionen priorisieren."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Überfällig" value={followups.overdue.length} tone={followups.overdue.length ? "danger" : "neutral"} />
        <MetricTile label="Heute" value={followups.today.length} tone={followups.today.length ? "warning" : "neutral"} />
        <MetricTile label="Diese Woche" value={followups.thisWeek.length} />
        <MetricTile label="Ohne Follow-up" value={followups.withoutFollowup.length} tone="warning" />
      </section>

      <div className="portalDashboardGrid">
        <FollowupList title="Heute fällig" leads={followups.today} empty="Heute ist nichts fällig." />
        <FollowupList title="Überfällig" leads={followups.overdue} empty="Keine überfälligen Follow-ups." />
        <FollowupList title="Diese Woche" leads={followups.thisWeek} empty="Diese Woche ist nichts geplant." />
        <FollowupList title="Ohne Follow-up" leads={followups.withoutFollowup} empty="Alle offenen Leads haben ein Follow-up." />
      </div>
    </PortalShell>
  );
}
