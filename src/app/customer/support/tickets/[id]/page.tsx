import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { addTicketMessage, getTicket, SUPPORT_PRIORITY_LABELS, SUPPORT_STATUS_LABELS, SUPPORT_TYPE_LABELS } from "@/lib/support";

type PageProps = { params: Promise<{ id: string }> };

async function reply(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.CUSTOMER]);
  const ticketId = String(formData.get("ticketId"));
  await addTicketMessage(session, ticketId, { message: String(formData.get("message") || "") });
  revalidatePath(`/customer/support/tickets/${ticketId}`);
}

export default async function CustomerTicketDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const { id } = await params;
  const ticket = await getTicket(session, id).catch(() => null);
  if (!ticket) notFound();

  return (
    <PortalShell
      eyebrow="Kundenportal"
      title={`${ticket.ticketNumber}`}
      description={ticket.subject}
      navItems={[
        { href: "/customer/support", label: "Support" },
        { href: "/customer/reports", label: "Berichte" },
        { href: "/customer/orders", label: "Aufträge" },
        { href: "/customer/dashboard", label: "Dashboard" },
      ]}
    >
      <DataSection title="Ticketdetails">
        <div className="tableWrap">
          <table>
            <tbody>
              <tr><th>Status</th><td><StatusBadge>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge></td></tr>
              <tr><th>Typ</th><td>{SUPPORT_TYPE_LABELS[ticket.type]}</td></tr>
              <tr><th>Priorität</th><td>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</td></tr>
              <tr><th>Auftrag</th><td>{ticket.order ? <Link className="textLink" href={`/customer/orders/${ticket.order.id}`}>{ticket.order.orderNumber}</Link> : "-"}</td></tr>
              <tr><th>Bericht</th><td>{ticket.report ? <Link className="textLink" href={`/customer/reports/${ticket.report.id}`}>{ticket.report.reportNumber}</Link> : "-"}</td></tr>
              <tr><th>Erstellt</th><td>{formatDateTime(ticket.createdAt)}</td></tr>
              <tr><th>Lösung</th><td>{ticket.resolution ?? "-"}</td></tr>
            </tbody>
          </table>
        </div>
      </DataSection>

      <DataSection title="Nachrichten" description="Der Verlauf zeigt nur öffentliche Antworten.">
        <div className="timeline">
          {ticket.messages.map((message) => (
            <article className="notice" key={message.id}>
              <strong>{message.sender?.role === "CUSTOMER" ? "Kunde" : "FLYERO Support"}</strong>
              <p>{message.message}</p>
              <small>{formatDateTime(message.createdAt)}</small>
            </article>
          ))}
        </div>
        <form action={reply} className="form" style={{ marginTop: 18 }}>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <label>
            Antwort
            <textarea name="message" required rows={4} placeholder="Nachricht an den Support" />
          </label>
          <button type="submit">Antwort senden</button>
        </form>
      </DataSection>
    </PortalShell>
  );
}
