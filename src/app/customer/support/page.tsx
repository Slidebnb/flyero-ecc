import Link from "next/link";
import { redirect } from "next/navigation";
import { TicketPriority, TicketType, UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerAreaName, customerOrderName, customerReportName, customerSafeText } from "@/app/customer/customerUx";
import { DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createTicket,
  listTickets,
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
  const waitingTicket = tickets.find((ticket) => ticket.status === "WAITING_FOR_CUSTOMER");
  const open = tickets.filter((ticket) => !["RESOLVED", "CLOSED"].includes(ticket.status)).length;
  const visibleTickets = tickets.slice(0, 8);

  return (
    <CustomerPortalShell
      active="/customer/support"
      title="Hilfe"
      description="Eine Frage stellen, eine Kampagne klären oder eine Rückfrage zum Bericht senden."
    >
      <section className={waitingTicket ? "customerWarningBanner" : "customerFocusPanel"}>
        <div>
          <span className="customerTinyLabel">Schnellkontakt</span>
          <h2>{waitingTicket ? "FLYERO wartet auf Ihre Antwort." : "Wobei dürfen wir helfen?"}</h2>
          <p>{waitingTicket ? customerSafeText(waitingTicket.subject, "FLYERO hat eine Rückfrage zu Ihrer Kampagne.") : "Kurz beschreiben reicht. Kampagne oder Bericht können Sie bei Bedarf ergänzen."}</p>
        </div>
        {waitingTicket ? (
          <Link className="primaryButton" href={`/customer/support/tickets/${waitingTicket.id}`}>Antworten</Link>
        ) : (
          <a className="primaryButton" href="#support-message">Nachricht schreiben</a>
        )}
      </section>

      <div className="customerTwoColumn">
        <DataSection title="Neue Nachricht" description="FLYERO ordnet Ihre Nachricht intern dem richtigen Auftrag zu." id="support-message">
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
              Nachricht
              <textarea name="description" required rows={5} placeholder="Wobei dürfen wir helfen?" />
            </label>
            <details className="customerSoftDetails compact">
              <summary>Kampagne oder Bericht zuordnen</summary>
              <div className="customerSimpleFormInline">
                <label>
                  Kampagne optional
                  <select name="orderKey" defaultValue="">
                    <option value="">Keine Kampagne auswählen</option>
                    {orders.map((order, index) => (
                      <option key={String(index)} value={String(index)}>{customerOrderName(order.orderNumber)} - {customerAreaName(order.targetAreaName)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Bericht optional
                  <select name="reportKey" defaultValue={selectedReportIndex >= 0 ? String(selectedReportIndex) : ""}>
                    <option value="">Keinen Bericht auswählen</option>
                    {reports.map((report, index) => (
                      <option key={String(index)} value={String(index)}>{customerReportName(report.reportNumber)} - {customerAreaName(report.order.targetAreaName)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <button type="submit">Nachricht senden</button>
          </form>
        </DataSection>

        <DataSection title={open ? "Offene Rückfragen" : "Meine Nachrichten"} description="Die neuesten Anfragen zuerst. Ältere Nachrichten bleiben im Verlauf gespeichert.">
          <div className="customerCampaignList compact">
            {visibleTickets.map((ticket) => (
              <article className="customerCampaignItem" key={ticket.id}>
                <div>
                  <div className="customerItemHeader">
                    <strong>{customerSafeText(ticket.subject, "Nachricht zu Ihrer Kampagne") || ticket.ticketNumber}</strong>
                    <StatusBadge tone={tone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge>
                  </div>
                  <p>{SUPPORT_TYPE_LABELS[ticket.type]}</p>
                </div>
                <Link className="secondaryButton" href={`/customer/support/tickets/${ticket.id}`}>Öffnen</Link>
              </article>
            ))}
            {tickets.length > visibleTickets.length ? (
              <p className="customerListHint">Weitere Nachrichten bleiben gespeichert. Die wichtigsten aktuellen Einträge stehen oben.</p>
            ) : null}
            {tickets.length === 0 ? (
              <EmptyState title="Noch keine Nachricht." description="Wenn etwas unklar ist, schreiben Sie FLYERO direkt hier." />
            ) : null}
          </div>
        </DataSection>
      </div>
    </CustomerPortalShell>
  );
}
