import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import {
  CUSTOMER_CHANNEL_LABELS,
  CUSTOMER_QUEUE_STATUS_LABELS,
  customerNotificationTypeLabel,
  customerPreferenceLabel,
  safeCustomerMessage,
  safeCustomerSubject,
} from "@/app/customer/customerUx";
import { ActionPanel, DataSection, EmptyState, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{ read?: string; typeKey?: string; date?: string }>;
};

function dateFilter(date?: string) {
  if (!date) return undefined;
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function deliveryLabel(status?: keyof typeof CUSTOMER_QUEUE_STATUS_LABELS) {
  return status ? CUSTOMER_QUEUE_STATUS_LABELS[status] : "Im Portal sichtbar";
}

export default async function CustomerNotificationsPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.CUSTOMER]);
  const filters = await searchParams;
  const readFilter = filters.read === "unread" ? { readAt: null } : filters.read === "read" ? { readAt: { not: null } } : {};
  const createdAt = dateFilter(filters.date);
  const allMessages = await prisma.notificationMessage.findMany({
    where: { userId: session.id, ...readFilter, ...(createdAt ? { createdAt } : {}) },
    include: { template: true, queues: { orderBy: { createdAt: "desc" }, take: 2 } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const preferences = await prisma.notificationPreference.findMany({ where: { userId: session.id }, orderBy: [{ type: "asc" }, { channel: "asc" }] });
  const types = [...new Set(allMessages.map((message) => message.type))].sort();
  const selectedType = filters.typeKey ? types[Number(filters.typeKey)] : undefined;
  const messages = selectedType ? allMessages.filter((message) => message.type === selectedType) : allMessages;

  return (
    <CustomerPortalShell active="/customer/notifications" title="Nachrichten" description="Statushinweise, Rechnungen, Berichte und E-Mail-Einstellungen an einem Ort.">
      <ActionPanel title="Filter" description="Grenzen Sie Nachrichten nach Lesestatus, Anlass oder Datum ein.">
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
            Anlass
            <select name="typeKey" defaultValue={filters.typeKey ?? ""}>
              <option value="">Alle Anlässe</option>
              {types.map((type, index) => <option key={String(index)} value={String(index)}>{customerNotificationTypeLabel(type)}</option>)}
            </select>
          </label>
          <label>
            Datum
            <input name="date" type="date" defaultValue={filters.date ?? ""} />
          </label>
          <button type="submit">Filtern</button>
        </form>
      </ActionPanel>

      <DataSection title="Nachrichtenzentrale" description="Alle Hinweise zu Kampagnen, Dateien, Zahlungen und Nachweisen.">
        <div className="stack">
          {messages.map((message) => {
            const latestQueueStatus = message.queues[0]?.status;
            return (
              <article key={message.id} className="messageCard">
                <div className="splitHeader">
                  <div>
                    <strong>{safeCustomerSubject(message.type, message.subject)}</strong>
                    <p className="muted">{customerNotificationTypeLabel(message.type)} · {formatDateTime(message.createdAt)} · {message.readAt ? "gelesen" : "ungelesen"}</p>
                  </div>
                  <StatusBadge tone={message.readAt ? "success" : latestQueueStatus === "FAILED" ? "danger" : "warning"}>{message.readAt ? "Gelesen" : latestQueueStatus === "FAILED" ? "Aktion erforderlich" : "Neu"}</StatusBadge>
                </div>
                <p>{safeCustomerMessage(message.type, message.body)}</p>
                <small className="muted">Zustellung: {deliveryLabel(latestQueueStatus)}</small>
              </article>
            );
          })}
          {messages.length === 0 ? <EmptyState title="Keine Nachrichten gefunden." description="Mit anderen Filtern oder neuen Kampagnen erscheinen hier Hinweise." /> : null}
        </div>
      </DataSection>

      <DataSection title="E-Mail-Einstellungen" description="Welche Hinweise Sie zusätzlich per E-Mail oder Push erhalten.">
        <div className="portalList">
          {preferences.map((preference) => (
            <p key={preference.id}><strong>{customerPreferenceLabel(preference.type)}</strong><br />{CUSTOMER_CHANNEL_LABELS[preference.channel]}: {preference.enabled ? "aktiv" : "deaktiviert"}</p>
          ))}
          {preferences.length === 0 ? <EmptyState title="Standard-Einstellungen aktiv." description="Wichtige Nachrichten werden automatisch zugestellt." /> : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
