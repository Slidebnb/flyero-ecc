import { UserRole } from "@prisma/client";
import { CustomerPortalShell } from "@/app/customer/CustomerPortalShell";
import {
  CUSTOMER_CHANNEL_LABELS,
  customerNotificationTypeLabel,
  customerPreferenceLabel,
  safeCustomerMessage,
  safeCustomerSubject,
} from "@/app/customer/customerUx";
import { DataSection, EmptyState, MetricTile, StatusBadge } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerNotificationsPage() {
  const session = await requireRole([UserRole.CUSTOMER]);
  const [messages, preferences] = await Promise.all([
    prisma.notificationMessage.findMany({
      where: { userId: session.id },
      include: { queues: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.notificationPreference.findMany({ where: { userId: session.id }, orderBy: [{ type: "asc" }, { channel: "asc" }] }),
  ]);
  const unread = messages.filter((message) => !message.readAt).length;
  const failed = messages.filter((message) => message.queues[0]?.status === "FAILED").length;

  return (
    <CustomerPortalShell
      active="/customer/notifications"
      title="Nachrichten"
      description="Nur wichtige Hinweise zu Kampagnen, Dateien, Zahlungen und Nachweisen."
    >
      <section className="portalMetrics">
        <MetricTile label="Nachrichten" value={messages.length} />
        <MetricTile label="Neu" value={unread} tone={unread ? "warning" : "success"} />
        <MetricTile label="Aktion nötig" value={failed} tone={failed ? "danger" : "success"} />
      </section>

      <DataSection title="Aktuelle Hinweise" description="FLYERO blendet technische Meldungen aus und zeigt nur das, was für Sie wichtig ist.">
        <div className="customerMessageList">
          {messages.map((message) => {
            const latestQueueStatus = message.queues[0]?.status;
            return (
              <article key={message.id} className="customerMessageItem">
                <div>
                  <span>{formatDateTime(message.createdAt)}</span>
                  <strong>{safeCustomerSubject(message.type, message.subject)}</strong>
                  <p>{safeCustomerMessage(message.type, message.body)}</p>
                </div>
                <StatusBadge tone={message.readAt ? "success" : latestQueueStatus === "FAILED" ? "danger" : "warning"}>
                  {message.readAt ? "Gelesen" : latestQueueStatus === "FAILED" ? "Aktion nötig" : "Neu"}
                </StatusBadge>
              </article>
            );
          })}
          {messages.length === 0 ? (
            <EmptyState title="Keine Nachrichten." description="Sobald es Neuigkeiten zu einer Kampagne gibt, erscheint die Meldung hier." />
          ) : null}
        </div>
      </DataSection>

      <DataSection title="Benachrichtigungen" description="Diese Hinweise können zusätzlich per E-Mail, WhatsApp, SMS oder Push zugestellt werden.">
        <div className="customerPreferenceList">
          {preferences.map((preference) => (
            <p key={preference.id}>
              <strong>{customerPreferenceLabel(preference.type)}</strong>
              <span>{CUSTOMER_CHANNEL_LABELS[preference.channel]} · {preference.enabled ? "aktiv" : "deaktiviert"} · {customerNotificationTypeLabel(preference.type)}</span>
            </p>
          ))}
          {preferences.length === 0 ? (
            <EmptyState title="Standard aktiv." description="Wichtige Nachrichten werden automatisch im Portal angezeigt." />
          ) : null}
        </div>
      </DataSection>
    </CustomerPortalShell>
  );
}
