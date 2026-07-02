import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { SupportTicketStatus, TicketMessageVisibility, TicketPriority, UserRole } from "@prisma/client";
import { ActionPanel, DataSection, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  addTicketMessage,
  closeTicket,
  getTicket,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  SUPPORT_TYPE_LABELS,
  updateTicket,
} from "@/lib/support";

type PageProps = { params: Promise<{ id: string }> };

async function updateTicketAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const ticketId = String(formData.get("ticketId"));
  await updateTicket(session, ticketId, {
    status: String(formData.get("status") || ""),
    priority: String(formData.get("priority") || ""),
    assignedToId: String(formData.get("assignedToId") || "") || null,
    resolution: String(formData.get("resolution") || "") || null,
  });
  revalidatePath(`/admin/support/tickets/${ticketId}`);
}

async function messageAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const ticketId = String(formData.get("ticketId"));
  await addTicketMessage(session, ticketId, {
    message: String(formData.get("message") || ""),
    visibility: String(formData.get("visibility") || TicketMessageVisibility.PUBLIC),
  });
  revalidatePath(`/admin/support/tickets/${ticketId}`);
}

async function closeAction(formData: FormData) {
  "use server";
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const ticketId = String(formData.get("ticketId"));
  await closeTicket(session, ticketId, String(formData.get("resolution") || "") || undefined);
  revalidatePath(`/admin/support/tickets/${ticketId}`);
}

export default async function AdminTicketDetailPage({ params }: PageProps) {
  const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
  const { id } = await params;
  const [ticket, assignees] = await Promise.all([
    getTicket(session, id).catch(() => null),
    prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER] } },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
    }),
  ]);
  if (!ticket) notFound();

  return (
    <PortalShell
      eyebrow="Admin Support"
      title={ticket.ticketNumber}
      description={ticket.subject}
      navItems={[
        { href: "/admin/support", label: "Support" },
        { href: "/admin/dashboard", label: "Dashboard" },
        { href: "/admin/reports", label: "Berichte" },
        { href: "/admin/tours", label: "Touren" },
      ]}
    >
      <div className="portalDashboardGrid">
        <DataSection title="Kontext">
          <div className="tableWrap">
            <table>
              <tbody>
                <tr><th>Status</th><td><StatusBadge>{SUPPORT_STATUS_LABELS[ticket.status]}</StatusBadge></td></tr>
                <tr><th>Typ</th><td>{SUPPORT_TYPE_LABELS[ticket.type]}</td></tr>
                <tr><th>Priorität</th><td>{SUPPORT_PRIORITY_LABELS[ticket.priority]}</td></tr>
                <tr><th>Kunde</th><td>{ticket.customer?.companyName ?? "-"}</td></tr>
                <tr><th>Verteiler intern</th><td>{ticket.distributor ? `${ticket.distributor.firstName} ${ticket.distributor.lastName}` : "-"}</td></tr>
                <tr><th>Auftrag</th><td>{ticket.order ? <Link className="textLink" href={`/admin/orders/${ticket.order.id}`}>{ticket.order.orderNumber}</Link> : "-"}</td></tr>
                <tr><th>Bericht</th><td>{ticket.report ? <Link className="textLink" href={`/admin/reports/${ticket.report.id}`}>{ticket.report.reportNumber}</Link> : "-"}</td></tr>
                <tr><th>Tour</th><td>{ticket.tour ? <Link className="textLink" href={`/admin/tours/${ticket.tour.id}`}>{ticket.tour.status}</Link> : "-"}</td></tr>
                <tr><th>Tourprüfung</th><td>{ticket.tour ? `${ticket.tour.adminReviewStatus ?? "-"} / Flags: ${JSON.stringify(ticket.tour.fraudFlags ?? {})}` : "-"}</td></tr>
                <tr><th>Lager</th><td>{ticket.warehouseInventory ? `${ticket.warehouseInventory.status} / ${ticket.warehouseInventory.qrCode}` : "-"}</td></tr>
                <tr><th>Erstellt</th><td>{formatDateTime(ticket.createdAt)}</td></tr>
              </tbody>
            </table>
          </div>
        </DataSection>

        <ActionPanel title="Ticket steuern">
          <form action={updateTicketAction} className="form">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label>
              Status
              <select name="status" defaultValue={ticket.status}>
                {Object.values(SupportTicketStatus).map((status) => <option key={status} value={status}>{SUPPORT_STATUS_LABELS[status]}</option>)}
              </select>
            </label>
            <label>
              Priorität
              <select name="priority" defaultValue={ticket.priority}>
                {Object.values(TicketPriority).map((priority) => <option key={priority} value={priority}>{SUPPORT_PRIORITY_LABELS[priority]}</option>)}
              </select>
            </label>
            <label>
              Zuständig
              <select name="assignedToId" defaultValue={ticket.assignedToId ?? ""}>
                <option value="">Nicht zugewiesen</option>
                {assignees.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
              </select>
            </label>
            <label>
              Lösung
              <textarea name="resolution" rows={3} defaultValue={ticket.resolution ?? ""} />
            </label>
            <button type="submit">Speichern</button>
          </form>
          <form action={closeAction} className="form" style={{ marginTop: 18 }}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label>
              Abschlussnotiz
              <textarea name="resolution" rows={3} defaultValue={ticket.resolution ?? ""} />
            </label>
            <button type="submit">Ticket schließen</button>
          </form>
        </ActionPanel>
      </div>

      <DataSection title="Nachrichten und interne Notizen">
        <div className="timeline">
          {ticket.messages.map((message) => (
            <article className="notice" key={message.id}>
              <strong>{message.visibility === "INTERNAL" ? "Interne Notiz" : message.sender?.role ?? "System"}</strong>
              <p>{message.message}</p>
              <small>{formatDateTime(message.createdAt)}</small>
            </article>
          ))}
        </div>
        <form action={messageAction} className="form grid" style={{ marginTop: 18 }}>
          <input type="hidden" name="ticketId" value={ticket.id} />
          <label>
            Sichtbarkeit
            <select name="visibility" defaultValue={TicketMessageVisibility.PUBLIC}>
              <option value={TicketMessageVisibility.PUBLIC}>Öffentliche Antwort</option>
              <option value={TicketMessageVisibility.INTERNAL}>Interne Notiz</option>
            </select>
          </label>
          <label className="full">
            Nachricht
            <textarea name="message" required rows={4} />
          </label>
          <button type="submit">Nachricht speichern</button>
        </form>
      </DataSection>
    </PortalShell>
  );
}
