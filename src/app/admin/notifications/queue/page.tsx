import { NotificationQueueStatus } from "@prisma/client";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { DataSection, MetricTile, PortalShell, StatusBadge } from "@/app/PortalComponents";
import { Permission, requirePermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { createAuditLog } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { createSystemLog } from "@/lib/monitoring";
import { processPendingNotifications, retryFailedNotification } from "@/lib/notificationWorker";
import { prisma } from "@/lib/prisma";
import { adminNavItems } from "@/app/admin/AdminPortalShell";

async function processQueueAction() {
  "use server";

  const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
  await processPendingNotifications({ triggeredById: session.id });
  revalidatePath("/admin/notifications/queue");
}

async function retryQueueAction(formData: FormData) {
  "use server";

  const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
  const id = String(formData.get("id") || "");
  await retryFailedNotification(id, session.id);
  revalidatePath("/admin/notifications/queue");
}

async function sendTestEmailAction(formData: FormData) {
  "use server";

  const session = await requirePermission(Permission.NOTIFICATION_OPERATIONS_MANAGE);
  const recipient = String(formData.get("recipient") || "").trim();
  const templateId = String(formData.get("templateId") || "").trim();
  const subjectInput = String(formData.get("subject") || "").trim();
  const textInput = String(formData.get("text") || "").trim();
  const template = templateId ? await prisma.notificationTemplate.findUnique({ where: { id: templateId } }) : null;
  const subject = template?.subject || subjectInput || "FLYERO Test-E-Mail";
  const text = template?.body || textInput || "Das ist eine FLYERO Test-E-Mail.";

  const result = await sendEmail({ to: recipient, subject, text, metadata: { test: true, triggeredById: session.id } });
  await createAuditLog({
    userId: session.id,
    action: "email.test_sent",
    entityType: "NotificationMessage",
    entityId: session.id,
    newValues: { recipient, provider: result.provider, messageId: result.messageId },
  });
  await createSystemLog({
    source: "email.test",
    message: `Test-E-Mail an ${recipient}`,
    metadata: { provider: result.provider, messageId: result.messageId },
  });
  revalidatePath("/admin/notifications/queue");
}

function queueTone(status: NotificationQueueStatus) {
  if (status === NotificationQueueStatus.SENT) return "success";
  if (status === NotificationQueueStatus.FAILED) return "danger";
  if (status === NotificationQueueStatus.RETRY) return "warning";
  return "neutral";
}

export default async function AdminNotificationQueuePage() {
  await requirePermission(Permission.NOTIFICATION_OPERATIONS_VIEW);
  const [queues, counts, templates] = await Promise.all([
    prisma.notificationQueue.findMany({
      include: {
        user: { select: { email: true, role: true } },
        template: { select: { id: true, key: true, name: true } },
        message: { select: { subject: true, type: true } },
      },
      orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
      take: 200,
    }),
    prisma.notificationQueue.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.notificationTemplate.findMany({ where: { channel: "EMAIL", isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const countFor = (status: NotificationQueueStatus) => counts.find((item) => item.status === status)?._count.status ?? 0;

  return (
    <PortalShell
      eyebrow="Adminbereich"
      title="E-Mail Queue"
      description="Wartende, gesendete und fehlgeschlagene E-Mails zentral verarbeiten."
      navItems={adminNavItems}
    >
      <section className="portalMetrics">
        <MetricTile label="Wartend" value={countFor(NotificationQueueStatus.PENDING)} tone="warning" />
        <MetricTile label="Senden" value={countFor(NotificationQueueStatus.SENDING)} />
        <MetricTile label="Gesendet" value={countFor(NotificationQueueStatus.SENT)} tone="success" />
        <MetricTile label="Retry" value={countFor(NotificationQueueStatus.RETRY)} tone="warning" />
        <MetricTile label="Fehlgeschlagen" value={countFor(NotificationQueueStatus.FAILED)} tone="danger" />
      </section>

      <section className="actionPanel">
        <div>
          <h2>Worker</h2>
          <p>Ein Lauf verarbeitet maximal 50 E-Mails. Nach 3 Fehlversuchen bleibt ein Eintrag auf FAILED.</p>
        </div>
        <form action={processQueueAction}>
          <button type="submit">Queue jetzt verarbeiten</button>
        </form>
      </section>

      <DataSection title="Test-E-Mail senden">
        <form className="form grid" action={sendTestEmailAction}>
          <label>
            Empfänger
            <input name="recipient" type="email" required placeholder="admin@example.com" />
          </label>
          <label>
            Vorlage optional
            <select name="templateId" defaultValue="">
              <option value="">Freier Text</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label>
            Betreff
            <input name="subject" defaultValue="FLYERO Test-E-Mail" />
          </label>
          <label className="full">
            Text
            <textarea name="text" defaultValue="Das ist eine FLYERO Test-E-Mail aus dem Adminbereich." />
          </label>
          <button type="submit">Test-E-Mail senden</button>
        </form>
      </DataSection>

      <DataSection title="Queue">
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Empfänger</th>
                <th>Template</th>
                <th>Betreff</th>
                <th>Versuche</th>
                <th>Geplant</th>
                <th>Fehler</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.id}>
                  <td><StatusBadge tone={queueTone(queue.status)}>{queue.status}</StatusBadge></td>
                  <td>{queue.user.email}<br /><small>{queue.user.role}</small></td>
                  <td>{queue.template?.name ?? "-"}</td>
                  <td>{queue.message.subject}<br /><small>{queue.message.type}</small></td>
                  <td>{queue.attempts}/{queue.maxAttempts}</td>
                  <td>{formatDateTime(queue.scheduledAt)}</td>
                  <td>{queue.lastError ?? "-"}</td>
                  <td>
                    {queue.status === NotificationQueueStatus.FAILED || queue.status === NotificationQueueStatus.RETRY ? (
                      <form action={retryQueueAction}>
                        <input type="hidden" name="id" value={queue.id} />
                        <button type="submit" disabled={queue.attempts >= 3}>Retry</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!queues.length ? <tr><td colSpan={8}>Keine Queue-Einträge vorhanden.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </DataSection>

      <p className="muted">
        <Link className="textLink" href="/admin/notifications">Zur Nachrichtenzentrale</Link>
      </p>
    </PortalShell>
  );
}
