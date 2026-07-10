import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName, customerReportName } from "@/app/customer/customerUx";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
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
  TicketType.OTHER,
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
    priority: type === TicketType.COMPLAINT ? TicketPriority.HIGH : TicketPriority.NORMAL,
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

  return (
    <CustomerPortalShell
      active="/customer/support"
      title="Support"
      description="Eine Frage stellen, eine Kampagne klären oder eine Rückfrage zum Bericht senden."
    >
      <section className="portalMetrics">
        <MetricTile label="Tickets" value={tickets.length} />
        <MetricTile label="Offen" value={open} tone={open ? "warning" : "success"} />
        <MetricTile label="Antwort" value="im Portal" />
      </section>

      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Schnellkontakt</span>
          <h2>Was soll FLYERO prüfen?</h2>
          <p>Wählen Sie optional eine Kampagne oder einen Bericht aus. So landet Ihre Anfrage direkt am richtigen Auftrag.</p>
        </div>
      </section>

      <div className="customerTwoColumn">
        <DataSection title="Neue Nachricht" description="Kurz beschreiben reicht. FLYERO ordnet den Rest intern zu.">
          <form action={createCustomerTicket} className="form customerSimpleForm">
            <label>
              Thema
              <select name="typeKey" defaultValue={selectedReportIndex >= 0 ? "1" : "0"}>
                {customerTicketTypes.map((typeValue, index) => (
                  <option key={String(index)} value={String(index)}>{SUPPORT_TYPE_LABELS[typeValue]}</option>
                ))}
              </select>
            </label>
            <label>
              Betreff
              <input name="subject" required placeholder="z. B. Rückfrage zur Verteilung" />
            </label>
            <label>
              Kampagne
              <select name="orderKey" defaultValue="">
                <option value="">Keine Kampagne auswählen</option>
                {orders.map((order, index) => (
                  <option key={String(index)} value={String(index)}>{customerOrderName(order.orderNumber)} - {order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Bericht
              <select name="reportKey" defaultValue={selectedReportIndex >= 0 ? String(selectedReportIndex) : ""}>
                <option value="">Keinen Bericht auswählen</option>
                {reports.map((report, index) => (
                  <option key={String(index)} value={String(index)}>{customerReportName(report.reportNumber)} - {report.order.targetAreaName}</option>
                ))}
              </select>
            </label>
            <label>
              Nachricht
              <textarea name="description" required rows={5} placeholder="Wobei dürfen wir helfen?" />
            </label>
            <button type="submit">Nachricht senden</button>
          </form>
        </DataSection>

        <DataSection title="Meine Anfragen" description="Offene Themen bleiben sichtbar, erledigte Themen rutschen nach unten.">
          <div className="customerCampaignList compact">
            {tickets.map((ticket) => (
              <article className="customerCampaignItem" key={ticket.id}>
                <div>
                  <div className="customerItemHeader">
                    <strong>{ticket.subject || ticket.ticketNumber}</strong>
                    <StatusBadge tone={tone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge>
                  </div>
                  <p>{SUPPORT_TYPE_LABELS[ticket.type]} · {SUPPORT_PRIORITY_LABELS[ticket.priority]}</p>
                </div>
                <Link className="secondaryButton" href={`/customer/support/tickets/${ticket.id}`}>Öffnen</Link>
              </article>
            ))}
            {tickets.length === 0 ? (
              <EmptyState title="Noch keine Support-Anfrage." description="Wenn etwas unklar ist, schreiben Sie FLYERO direkt hier." />
            ) : null}
          </div>
        </DataSection>
      </div>
    </CustomerPortalShell>
  );
}
