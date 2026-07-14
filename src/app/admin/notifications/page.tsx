import Link from "next/link";
import { NotificationAudience, NotificationChannel } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productionUserWhere } from "@/lib/productionData";
import { EmptyState } from "@/app/PortalComponents";
import { TemplatePreviewForm } from "./TemplatePreviewForm";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";

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

export default async function AdminNotificationsPage({ searchParams }: PageProps) {
  await requirePermission(Permission.NOTIFICATION_OPERATIONS_VIEW);
  const filters = await searchParams;
  const readFilter = filters.read === "unread" ? { readAt: null } : filters.read === "read" ? { readAt: { not: null } } : {};
  const typeFilter = filters.type ? { type: filters.type } : {};
  const createdAt = dateFilter(filters.date);
  const [messages, queues, templates, logs, preferences] = await Promise.all([
    prisma.notificationMessage.findMany({
      where: { audience: { in: ["ADMIN", "INTERNAL"] }, user: productionUserWhere(), ...readFilter, ...typeFilter, ...(createdAt ? { createdAt } : {}) },
      include: { user: true, template: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notificationQueue.findMany({
      where: { user: productionUserWhere() },
      include: { user: true, template: true },
      orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
      take: 100,
    }),
    prisma.notificationTemplate.findMany({ orderBy: [{ audience: "asc" }, { name: "asc" }] }),
    prisma.notificationLog.findMany({ where: { user: productionUserWhere() }, include: { user: true, template: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notificationPreference.findMany({ where: { user: productionUserWhere() }, include: { user: true }, orderBy: [{ userId: "asc" }, { type: "asc" }], take: 100 }),
  ]);
  const types = [...new Set(messages.map((message) => message.type))].sort();

  return (
    <AdminPortalShell eyebrow="Adminbereich" title="Nachrichtenzentrale">

      <section className="gridCards">
        <article className="card"><strong>{messages.length}</strong><span>Nachrichten</span></article>
        <article className="card"><strong>{queues.filter((item) => item.status === "PENDING").length}</strong><span>Queue offen</span></article>
        <article className="card"><strong>{templates.length}</strong><span>Vorlagen</span></article>
        <article className="card"><strong>{logs.length}</strong><span>Logs</span></article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Filter</h2>
        <form className="form grid" action="/admin/notifications" method="get">
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
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Nachrichten</h2>
        {messages.length === 0 ? (
          <EmptyState
            title="Keine Nachrichten gefunden."
            description="Mit anderen Filtern oder neuen Systemereignissen erscheinen hier interne Hinweise."
          />
        ) : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Datum</th><th>Empfänger</th><th>Typ</th><th>Betreff</th><th>Status</th></tr></thead>
              <tbody>
                {messages.map((message) => (
                  <tr key={message.id}>
                    <td>{formatDateTime(message.createdAt)}</td>
                    <td>{message.user.email}</td>
                    <td>{message.type}</td>
                    <td>{message.subject}</td>
                    <td>{message.readAt ? "gelesen" : "ungelesen"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="gridTwo" style={{ marginTop: 18 }}>
        <article className="panel stack">
          <h2 className="sectionTitle">Vorlage erstellen</h2>
          <form className="form" action="/api/admin/templates" method="post">
            <label>Key<input name="key" defaultValue="CUSTOM_TEMPLATE" required /></label>
            <label>Name<input name="name" defaultValue="Eigene Vorlage" required /></label>
            <label>Zielgruppe
              <select name="audience" defaultValue={NotificationAudience.CUSTOMER}>
                {Object.values(NotificationAudience).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Kanal
              <select name="channel" defaultValue={NotificationChannel.EMAIL}>
                {Object.values(NotificationChannel).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Betreff<input name="subject" defaultValue="Hallo {{customerName}}" required /></label>
            <label>Text<textarea name="body" defaultValue="Auftrag {{orderNumber}} ist aktualisiert." required /></label>
            <button type="submit">Vorlage speichern</button>
          </form>
        </article>
        <article className="panel stack">
          <h2 className="sectionTitle">Vorschau / Test vorbereitet</h2>
          <TemplatePreviewForm templates={templates.map((template) => ({ id: template.id, name: template.name }))} />
          <p className="muted">Echten Testversand und Queue-Verarbeitung findest du unter <Link className="textLink" href="/admin/notifications/queue">E-Mail Queue</Link>.</p>
        </article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Queue</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Status</th><th>Kanal</th><th>Empfänger</th><th>Vorlage</th><th>Geplant</th><th>Fehler</th></tr></thead>
            <tbody>
              {queues.map((queue) => (
                <tr key={queue.id}>
                  <td>{queue.status}</td>
                  <td>{queue.channel}</td>
                  <td>{queue.user.email}</td>
                  <td>{queue.template?.name ?? "-"}</td>
                  <td>{formatDateTime(queue.scheduledAt)}</td>
                  <td>{queue.lastError ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gridTwo" style={{ marginTop: 18 }}>
        <article className="panel stack">
          <h2 className="sectionTitle">Preferences</h2>
          {preferences.slice(0, 20).map((preference) => (
            <p key={preference.id}><strong>{preference.user.email}</strong><br />{preference.type} / {preference.channel}: {preference.enabled ? "aktiv" : "aus"}</p>
          ))}
        </article>
        <article className="panel stack">
          <h2 className="sectionTitle">Logs</h2>
          {logs.slice(0, 20).map((log) => (
            <p key={log.id}><strong>{log.action}</strong><br /><span className="muted">{formatDateTime(log.createdAt)} / {log.template?.name ?? log.user?.email ?? "-"}</span></p>
          ))}
        </article>
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Vorlagen</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Name</th><th>Key</th><th>Zielgruppe</th><th>Kanal</th><th>Platzhalter</th><th>Status</th></tr></thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.key}</td>
                  <td>{template.audience}</td>
                  <td>{template.channel}</td>
                  <td>{template.placeholders.join(", ") || "-"}</td>
                  <td>{template.isActive ? "aktiv" : "inaktiv"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPortalShell>
  );
}
