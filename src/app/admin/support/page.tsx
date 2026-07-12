import Link from "next/link";
import { SupportTicketStatus, TicketPriority, TicketType, UserRole } from "@prisma/client";
import { adminNavItems } from "@/app/admin/AdminPortalShell";
import { DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import {
  getSupportAnalytics,
  listTickets,
  parseTicketFilters,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_LABELS,
} from "@/lib/support";

function tone(status: string, priority?: string) {
  if (priority === TicketPriority.URGENT) return "danger" as const;
  if (status === SupportTicketStatus.CLOSED || status === SupportTicketStatus.RESOLVED) return "success" as const;
  if (status === SupportTicketStatus.WAITING_FOR_CUSTOMER || status === SupportTicketStatus.WAITING_INTERNAL) return "warning" as const;
  return "neutral" as const;
}

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const params = await searchParams;
  const filters = parseTicketFilters(params);
  const [tickets, analytics] = await Promise.all([listTickets(session, filters), getSupportAnalytics({ tenantId: session.tenantId })]);

  return (
    <PortalShell
      eyebrow="Adminbereich"
      title="Support & Reklamationen"
      description="Zentrale Prüfung für Kundenanfragen, Reklamationen, Tourprobleme und interne Klärfälle."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Offene Tickets" value={analytics.openTickets} tone={analytics.openTickets ? "warning" : "success"} />
        <MetricTile label="Dringend" value={analytics.urgentTickets} tone={analytics.urgentTickets ? "danger" : "success"} />
        <MetricTile label="Reklamationen diesen Monat" value={analytics.complaintsThisMonth} tone={analytics.complaintsThisMonth ? "warning" : "neutral"} />
        <MetricTile label="Ø Lösungszeit" value={`${analytics.avgResolutionHours} h`} />
      </section>

      <DataSection title="Filter">
        <form className="form grid">
          <label>
            Suche
            <input name="q" defaultValue={filters.q ?? ""} placeholder="Ticket, Betreff, Auftrag" />
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Alle</option>
              {Object.values(SupportTicketStatus).map((status) => <option key={status} value={status}>{SUPPORT_STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label>
            Typ
            <select name="type" defaultValue={filters.type ?? ""}>
              <option value="">Alle</option>
              {Object.values(TicketType).map((type) => <option key={type} value={type}>{SUPPORT_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label>
            Priorität
            <select name="priority" defaultValue={filters.priority ?? ""}>
              <option value="">Alle</option>
              {Object.values(TicketPriority).map((priority) => <option key={priority} value={priority}>{SUPPORT_PRIORITY_LABELS[priority]}</option>)}
            </select>
          </label>
          <button type="submit">Filtern</button>
        </form>
      </DataSection>

      <DataSection title="Tickets" description="Kunden- und Verteiler-Tickets mit sicherem Detailzugriff.">
        <div className="tableWrap">
          <table>
            <thead><tr><th>Ticket</th><th>Typ</th><th>Status</th><th>Priorität</th><th>Bezug</th><th></th></tr></thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td><strong>{ticket.ticketNumber}</strong><br />{ticket.subject}</td>
                  <td>{SUPPORT_TYPE_LABELS[ticket.type]}</td>
                  <td><StatusBadge tone={tone(ticket.status, ticket.priority)}>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge></td>
                  <td>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</td>
                  <td>{ticket.order?.orderNumber ?? ticket.report?.reportNumber ?? ticket.tour?.status ?? "-"}</td>
                  <td><Link className="textLink" href={`/admin/support/tickets/${ticket.id}`}>Prüfen</Link></td>
                </tr>
              ))}
              {tickets.length === 0 ? <tr><td colSpan={6}><EmptyState title="Keine Tickets im Filter." /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>
    </PortalShell>
  );
}
