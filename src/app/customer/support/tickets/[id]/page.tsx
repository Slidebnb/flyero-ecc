import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { customerOrderName, customerReportName, customerSafeText } from "@/app/customer/customerUx";
import { DataSection, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { addTicketMessage, getTicket, SUPPORT_STATUS_LABELS, SUPPORT_TYPE_LABELS } from "@/lib/support";

type PageProps = { params: Promise<{ id: string }> };

async function reply(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const ticketId = String(formData.get("ticketId"));
  await addTicketMessage(session, ticketId, { message: String(formData.get("message") || "") });
  revalidatePath(`/customer/support/tickets/${ticketId}`);
}

function ticketTone(status: string) {
  if (status === "CLOSED" || status === "RESOLVED") return "success" as const;
  if (status === "WAITING_FOR_CUSTOMER" || status === "WAITING_INTERNAL") return "warning" as const;
  return "neutral" as const;
}

export default async function CustomerTicketDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const ticket = await getTicket(session, id).catch(() => null);
  if (!ticket) notFound();

  return (
    <CustomerPortalShell active="/customer/support" title={ticket.ticketNumber} description={customerSafeText(ticket.subject, "Nachricht zu Ihrer Kampagne")}>
      <section className="customerFocusPanel">
        <div>
          <span className="customerTinyLabel">Hilfe</span>
          <h2>{SUPPORT_STATUS_LABELS[ticket.status]}</h2>
          <p>{ticket.status === "WAITING_FOR_CUSTOMER" ? "FLYERO wartet auf Ihre Antwort." : "Alle Antworten stehen hier gebündelt."}</p>
        </div>
        <StatusBadge tone={ticketTone(ticket.status)}>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge>
      </section>

      <section className="customerDetailActions" aria-label="Hilfeaktionen">
        <Link className="secondaryButton" href="/customer/support">Alle Anfragen</Link>
        <Link className="secondaryButton" href="/customer/reports">Nachweise</Link>
        <Link className="secondaryButton" href="/customer/orders">Kampagnen</Link>
      </section>

      <div className="customerTwoColumn">
        <DataSection title="Anliegen" description="Kurz zusammengefasst.">
          <div className="customerFactList">
            <p><span>Status</span><strong>{SUPPORT_STATUS_LABELS[ticket.status]}</strong></p>
            <p><span>Thema</span><strong>{SUPPORT_TYPE_LABELS[ticket.type]}</strong></p>
            <p><span>Erstellt</span><strong>{formatDateTime(ticket.createdAt)}</strong></p>
            <p><span>Lösung</span><strong>{customerSafeText(ticket.resolution, "Noch offen")}</strong></p>
          </div>
        </DataSection>

        <DataSection title="Bezug" description="Direkt zur passenden Kampagne oder zum Bericht.">
          <div className="customerProofBullets">
            <p>
              <strong>Kampagne</strong>
              <span>{ticket.order ? <Link className="secondaryButton" href={`/customer/orders/${ticket.order.id}`}>{customerOrderName(ticket.order.orderNumber)}</Link> : "Nicht verknüpft"}</span>
            </p>
            <p>
              <strong>Bericht</strong>
              <span>{ticket.report ? <Link className="secondaryButton" href={`/customer/reports/${ticket.report.id}`}>{customerReportName(ticket.report.reportNumber)}</Link> : "Nicht verknüpft"}</span>
            </p>
          </div>
        </DataSection>
      </div>

      <DataSection title="Nachrichten" description="Der Verlauf zeigt nur öffentliche Antworten.">
        <div className="customerMessageList">
          {ticket.messages.map((message) => (
            <article className="customerMessageItem" key={message.id}>
              <div className="customerItemHeader">
                <strong>{message.sender?.role === "CUSTOMER" ? "Kunde" : "FLYERO Support"}</strong>
                <span>{formatDateTime(message.createdAt)}</span>
              </div>
              <p>{customerSafeText(message.message, "FLYERO hat eine neue Antwort hinterlegt.")}</p>
            </article>
          ))}
          {ticket.messages.length === 0 ? <p className="muted">Noch keine Antworten vorhanden.</p> : null}
        </div>
        <form action={reply} className="form customerSimpleForm" style={{ marginTop: 18 }}>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <label>
            Antwort
            <textarea name="message" required rows={4} placeholder="Nachricht an den Support" />
          </label>
          <button type="submit">Antwort senden</button>
        </form>
      </DataSection>
    </CustomerPortalShell>
  );
}
