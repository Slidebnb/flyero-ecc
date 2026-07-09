import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { ActionPanel, DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTicket,
  listTickets,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_LABELS,
} from "@/lib/support";

const customerTicketTypes = [
  TicketType.CUSTOMER_SUPPORT,
  TicketType.COMPLAINT,
  TicketType.BILLING_ISSUE,
  TicketType.TECHNICAL_ISSUE,
  TicketType.OTHER,
];

const customerPriorities = [
  TicketPriority.NORMAL,
  TicketPriority.HIGH,
  TicketPriority.LOW,
  TicketPriority.URGENT,
];

async function customerOrderOptions(sessionId: string) {
  return prisma.order.findMany({
    where: { customer: { userId: sessionId } },
    select: { id: true, orderNumber: true, targetAreaName: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
}

async function customerReportOptions(sessionId: string) {
  return prisma.report.findMany({
    where: { customer: { userId: sessionId } },
    include: { order: { select: { orderNumber: true, targetAreaName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
}

async function createCustomerTicket(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const [orders, reports] = await Promise.all([
    customerOrderOptions(session.id),
    customerReportOptions(session.id),
  ]);
  const type = customerTicketTypes[Number(formData.get("typeKey") || 0)] ?? TicketType.CUSTOMER_SUPPORT;
  const priority = customerPriorities[Number(formData.get("priorityKey") || 0)] ?? TicketPriority.NORMAL;
  const selectedReport = reports[Number(formData.get("reportKey") || -1)] ?? null;
  const selectedOrder = orders[Number(formData.get("orderKey") || -1)] ?? null;
  const report = selectedReport
    ? await prisma.report.findFirst({
        where: { id: selectedReport.id, customer: { userId: session.id } },
        select: { id: true, orderId: true, tourId: true },
      })
    : null;

  const ticket = await createTicket(session, {
    type,
    priority,
    subject: String(formData.get("subject") || ""),
    description: String(formData.get("description") || ""),
    orderId: report?.orderId ?? selectedOrder?.id,
    reportId: report?.id,
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
    customerOrderOptions(session.id),
    customerReportOptions(session.id),
  ]);

  const selectedReportIndex = reportId ? reports.findIndex((report) => report.id === reportId) : -1;
  const open = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const complaints = tickets.filter((ticket) => ticket.type === TicketType.COMPLAINT).length;

  return (
    <CustomerPortalShell
      active="/customer/support"
      title="Support & Reklamationen"
      description="Fragen, Reklamationen und Rückfragen zu Kampagnen oder Berichten zentral verfolgen."
    >
      <section className="portalMetrics">
        <MetricTile label="Tickets" value={tickets.length} />
        <MetricTile label="Offen" value={open} tone={open ? "warning" : "success"} />
        <MetricTile label="Reklamationen" value={complaints} tone={complaints ? "warning" : "neutral"} />
      </section>

      <div className="portalDashboardGrid">
        <ActionPanel title="Neues Ticket erstellen" description="Wählen Sie optional eine Kampagne oder einen Bericht aus, damit der Support schneller prüfen kann.">
          <form action={createCustomerTicket} className="form">
            <label>
              Thema
              <input name="subject" required placeholder="Kurzer Betreff" />
            </label>
            <label>
              Anliegen
              <select name="typeKey" defaultValue={selectedReportIndex >= 0 ? "1" : "0"}>
                {customerTicketTypes.map((typeValue, index) => (
                  <option key={String(index)} value={String(index)}>{SUPPORT_TYPE_LABELS[typeValue]}</option>
                ))}
              </select>
            </label>
            <label>
              Dringlichkeit
              <select name="priorityKey" defaultValue={TicketPriority.NORMAL === customerPriorities[0] ? "0" : "1"}>
                {customerPriorities.map((priority, index) => (
                  <option key={String(index)} value={String(index)}>{SUPPORT_PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </label>
            <label>
              Kampagne
              <select name="orderKey" defaultValue="">
                <option value="">Keine Kampagne ausgewählt</option>
                {orders.map((order, index) => (
                  <option key={String(index)} value={String(index)}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Bericht
              <select name="reportKey" defaultValue={selectedReportIndex >= 0 ? String(selectedReportIndex) : ""}>
                <option value="">Kein Bericht ausgewählt</option>
                {reports.map((report, index) => (
                  <option key={String(index)} value={String(index)}>{customerReportName(report.reportNumber)} - {report.order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Nachricht
              <textarea name="description" required rows={5} placeholder="Beschreiben Sie kurz, was geprüft werden soll." />
            </label>
            <button type="submit">Ticket senden</button>
          </form>
        </ActionPanel>

        <DataSection title="Meine Tickets" description="Interne Notizen sind hier bewusst nicht sichtbar.">
          <div className="tableWrap">
            <table>
              <thead><tr><th>Ticket</th><th>Anliegen</th><th>Status</th><th>Dringlichkeit</th><th></th></tr></thead>
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
                {tickets.length === 0 ? <tr><td colSpan={5}><EmptyState title="Noch keine Support-Tickets." description="Wenn etwas unklar ist, können Sie hier direkt ein Ticket eröffnen." /></td></tr> : null}
              </tbody>
            </table>
          </div>
        </DataSection>
      </div>
    </CustomerPortalShell>
  );
}
