import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import { ActionPanel, DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ read?: string; type?: string; date?: string }>;
};

function dateFilter(date?: string) {
  if (!date) return undefined;
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export default async function CustomerNotificationsPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const filters = await searchParams;
  const readFilter = filters.read === "unread" ? { readAt: null } : filters.read === "read" ? { readAt: { not: null } } : {};
  const createdAt = dateFilter(filters.date);
  const messages = await prisma.notificationMessage.findMany({
    where: { userId: session.id, ...readFilter, ...(filters.type ? { type: filters.type } : {}), ...(createdAt ? { createdAt } : {}) },
    include: { template: true, queues: { orderBy: { createdAt: "desc" }, take: 2 } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const preferences = await prisma.notificationPreference.findMany({ where: { userId: session.id }, orderBy: [{ type: "asc" }, { channel: "asc" }] });
  const types = [...new Set(messages.map((message) => message.type))].sort();

  return (
    <CustomerPortalShell active="/customer/notifications" title="Nachrichten" description="Benachrichtigungen, Statushinweise und E-Mail-Einstellungen an einem Ort.">
      <ActionPanel title="Filter" description="Grenzen Sie Nachrichten nach Lesestatus, Typ oder Datum ein.">
        <form className="form grid" action="/customer/notifications" method="get">
          <label>
            Lesestatus
            <select name="read" defaultValue={filters.read ?? ""}>
              <option value="">Alle</option>
              <option value="unread">Ungelesen</option>
              <option value="read">Gelesen</option>
            </select>
          </label>
          <label>
            Typ
            <select name="type" defaultValue={filters.type ?? ""}>
              <option value="">Alle Typen</option>
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Datum
            <input name="date" type="date" defaultValue={filters.date ?? ""} />
          </label>
          <button type="submit">Filtern</button>
        </form>
      </ActionPanel>

      <DataSection title="Nachrichtenzentrale" description="Alle Systemhinweise zu Ihren Aufträgen und Dokumenten.">
        <div className="stack">
          {messages.map((message) => (
            <article key={message.id} className="messageCard">
              <div className="splitHeader">
                <div>
                  <strong>{message.subject}</strong>
                  <p className="muted">{message.type} / {formatDateTime(message.createdAt)} / {message.readAt ? "gelesen" : "ungelesen"}</p>
                </div>
                <StatusBadge tone={message.readAt ? "success" : "warning"}>{message.readAt ? "Gelesen" : "Neu"}</StatusBadge>
              </div>
              <p>{message.body}</p>
              <small className="muted">Queue: {message.queues[0]?.status ?? "nicht geplant"}</small>
            </article>
          ))}
          {messages.length === 0 ? <EmptyState title="Keine Nachrichten gefunden." description="Mit anderen Filtern oder neuen Aufträgen erscheinen hier Hinweise." /> : null}
        </div>
      </DataSection>

      <DataSection title="E-Mail-Einstellungen" description="Aktive Benachrichtigungskanäle für Ihr Kundenkonto.">
        <div className="portalList">
          {preferences.map((preference) => (
            <p key={preference.id}><strong>{preference.type}</strong><br />{preference.channel}: {preference.enabled ? "aktiv" : "deaktiviert"}</p>
          ))}
          {preferences.length === 0 ? <EmptyState title="Standard-Einstellungen aktiv." description="Wichtige Nachrichten werden automatisch zugestellt." /> : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
