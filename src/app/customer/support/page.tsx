import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { ActionPanel, DataSection, EmptyState, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTicket,
  listTickets,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_LABELS,
} from "@/lib/support";

async function createCustomerTicket(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const reportId = String(formData.get("reportId") || "");
  const report = reportId
    ? await prisma.report.findFirst({
        where: { id: reportId, customer: { userId: session.id } },
        select: { orderId: true, tourId: true },
      })
    : null;
  const ticket = await createTicket(session, {
    type: String(formData.get("type") || TicketType.CUSTOMER_SUPPORT),
    priority: String(formData.get("priority") || TicketPriority.NORMAL),
    subject: String(formData.get("subject") || ""),
    description: String(formData.get("description") || ""),
    orderId: String(formData.get("orderId") || report?.orderId || "") || undefined,
    reportId: reportId || undefined,
    tourId: report?.tourId,
  });
  redirect(`/customer/support/tickets/${ticket.id}`);
}

function tone(status: string) {
  if (status === "CLOSED" || status === "RESOLVED") return "success" as const;
  if (status === "WAITING_FOR_CUSTOMER" || status === "WAITING_INTERNAL") return "warning" as const;
  return "neutral" as const;
}

export default async function CustomerSupportPage({ searchParams }: { searchParams: Promise<{ reportId?: string }> }) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { reportId } = await searchParams;
  const [tickets, orders, reports] = await Promise.all([
    listTickets(session),
    prisma.order.findMany({
      where: { customer: { userId: session.id } },
      select: { id: true, orderNumber: true, targetAreaName: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.report.findMany({
      where: { customer: { userId: session.id } },
      include: { order: { select: { orderNumber: true, targetAreaName: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  const open = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const complaints = tickets.filter((ticket) => ticket.type === TicketType.COMPLAINT).length;

  return (
    <PortalShell
      eyebrow="Kundenportal"
      title="Support & Reklamationen"
      description="Fragen, Reklamationen und Rückfragen zu Aufträgen oder Berichten zentral verfolgen."
      navItems={[
        { href: "/customer/dashboard", label: "Dashboard" },
        { href: "/customer/orders", label: "Aufträge" },
        { href: "/customer/reports", label: "Berichte" },
        { href: "/customer/invoices", label: "Rechnungen" },
      ]}
    >
      <section className="portalMetrics">
        <MetricTile label="Tickets" value={tickets.length} />
        <MetricTile label="Offen" value={open} tone={open ? "warning" : "success"} />
        <MetricTile label="Reklamationen" value={complaints} tone={complaints ? "warning" : "neutral"} />
      </section>

      <div className="portalDashboardGrid">
        <ActionPanel title="Neues Ticket erstellen" description="Wähle optional einen Auftrag oder Bericht aus, damit der Support schneller prüfen kann.">
          <form action={createCustomerTicket} className="form">
            <label>
              Thema
              <input name="subject" required placeholder="Kurzer Betreff" />
            </label>
            <label>
              Typ
              <select name="type" defaultValue={reportId ? TicketType.COMPLAINT : TicketType.CUSTOMER_SUPPORT}>
                {Object.values(TicketType).map((typeValue) => (
                  <option key={typeValue} value={typeValue}>{SUPPORT_TYPE_LABELS[typeValue]}</option>
                ))}
              </select>
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
              Auftrag
              <select name="orderId" defaultValue="">
                <option value="">Kein Auftrag ausgewählt</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{order.orderNumber} - {order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Bericht
              <select name="reportId" defaultValue={reportId ?? ""}>
                <option value="">Kein Bericht ausgewählt</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>{report.reportNumber} - {report.order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Nachricht
              <textarea name="description" required rows={5} placeholder="Beschreibe kurz, was geprüft werden soll." />
            </label>
            <button type="submit">Ticket senden</button>
          </form>
        </ActionPanel>

        <DataSection title="Meine Tickets" description="Interne Notizen sind hier bewusst nicht sichtbar.">
          <div className="tableWrap">
            <table>
              <thead><tr><th>Ticket</th><th>Typ</th><th>Status</th><th>Priorität</th><th></th></tr></thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td><strong>{ticket.ticketNumber}</strong><br />{ticket.subject}</td>
                    <td>{SUPPORT_TYPE_LABELS[ticket.type]}</td>
                    <td><StatusBadge tone={tone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge></td>
                    <td>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</td>
                    <td><Link className="textLink" href={`/customer/support/tickets/${ticket.id}`}>Öffnen</Link></td>
                  </tr>
                ))}
                {tickets.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Support-Tickets." description="Wenn etwas unklar ist, kannst du hier direkt ein Ticket eröffnen." /></td></tr> : null}
              </tbody>
            </table>
          </div>
        </DataSection>
      </div>
    </PortalShell>
  );
}
