import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTicket, listTickets, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS } from "@/lib/support";

async function createDistributorTicket(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const ticket = await createTicket(session, {
    type: TicketType.TOUR_ISSUE,
    priority: String(formData.get("priority") || TicketPriority.NORMAL),
    subject: String(formData.get("subject") || ""),
    description: String(formData.get("description") || ""),
    tourId: String(formData.get("tourId") || "") || undefined,
  });
  redirect(`/distributor/support/tickets/${ticket.id}`);
}

export default async function DistributorSupportPage() {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
  const [tickets, tours] = await Promise.all([
    listTickets(session),
    prisma.distributionTour.findMany({
      where: { distributor: { userId: session.id } },
      include: { order: { select: { orderNumber: true, targetAreaName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);
  const open = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;

  return (
    <PortalShell
      eyebrow="Verteilerportal"
      title="Support"
      description="Melde Tourprobleme direkt mit Bezug zur betroffenen Tour."
      navItems={[
        { href: "/distributor/dashboard", label: "Dashboard" },
        { href: "/distributor/tours", label: "Touren" },
      ]}
    >
      <section className="portalMetrics">
        <MetricTile label="Tickets" value={tickets.length} />
        <MetricTile label="Offen" value={open} tone={open ? "warning" : "success"} />
      </section>

      <div className="portalDashboardGrid">
        <ActionPanel title="Tourproblem melden">
          <form action={createDistributorTicket} className="form">
            <label>
              Betreff
              <input name="subject" required placeholder="Kurzer Betreff" />
            </label>
            <label>
              Priorität
              <select name="priority" defaultValue={TicketPriority.NORMAL}>
                {Object.values(TicketPriority).map((priority) => (
                  <option key={priority} value={priority}>{SUPPORT_PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </label>
            <label>
              Tour
              <select name="tourId" defaultValue="">
                <option value="">Keine Tour ausgewählt</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>{tour.order.orderNumber} - {tour.order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Nachricht
              <textarea name="description" required rows={5} />
            </label>
            <button type="submit">Ticket senden</button>
          </form>
        </ActionPanel>

        <DataSection title="Meine Support-Tickets">
          <div className="tableWrap">
            <table>
              <thead><tr><th>Ticket</th><th>Status</th><th>Priorität</th><th></th></tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><strong>{ticket.ticketNumber}</strong><br />{ticket.subject}</td>
                    <td><StatusBadge>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge></td>
                    <td>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</td>
                    <td><Link className="textLink" href={`/distributor/support/tickets/${ticket.id}`}>Öffnen</Link></td>
                  </tr>
                ))}
                {tickets.length === 0 ? <tr><td colSpan={4}><EmptyState title="Noch keine Support-Tickets." /></td></tr> : null}
              </tbody>
            </table>
          </div>
        </DataSection>
      </div>
    </PortalShell>
  );
}
