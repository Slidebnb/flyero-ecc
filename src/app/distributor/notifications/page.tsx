import Link from "next/link";
import { UserRole } from "@prisma/client";
import { EmptyState } from "@/app/PortalComponents";
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

export default async function DistributorNotificationsPage({ searchParams }: PageProps) {
  const session = await requireRole([UserRole.DISTRIBUTOR]);
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
    <main className="appShell mobileAppShell">
      <header className="mobileTopbar">
        <div>
          <p className="eyebrow">Verteiler-App</p>
          <h1>Nachrichten</h1>
        </div>
        <Link href="/distributor/dashboard">Heute</Link>
      </header>

      <section className="mobileCard stack">
        <h2 className="sectionTitle">Filter</h2>
        <form className="form" action="/distributor/notifications" method="get">
          <label>Lesestatus
            <select name="read" defaultValue={filters.read ?? ""}>
              <option value="">Alle</option>
              <option value="unread">Ungelesen</option>
              <option value="read">Gelesen</option>
            </select>
          </label>
          <label>Typ
            <select name="type" defaultValue={filters.type ?? ""}>
              <option value="">Alle Typen</option>
              {types.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>Datum<input name="date" type="date" defaultValue={filters.date ?? ""} /></label>
          <button type="submit">Filtern</button>
        </form>
      </section>

      <section className="mobileList">
        <h2 className="sectionTitle">Nachrichtenzentrale</h2>
        {messages.map((message) => (
          <article key={message.id} className="mobileCard stack">
            <div className="splitHeader">
              <strong>{message.subject}</strong>
              <span className={message.readAt ? "badge success" : "badge warning"}>{message.readAt ? "Gelesen" : "Neu"}</span>
            </div>
            <p className="muted">{message.type} / {formatDateTime(message.createdAt)}</p>
            <p>{message.body}</p>
            <small>Queue: {message.queues[0]?.status ?? "nicht geplant"}</small>
          </article>
        ))}
        {messages.length === 0 ? (
          <EmptyState
            title="Keine Nachrichten gefunden."
            description="Neue Aufträge, Tourhinweise und Support-Antworten erscheinen hier automatisch."
            action={{ href: "/distributor/dashboard", label: "Heute öffnen" }}
          />
        ) : null}
      </section>

      <section className="mobileList">
        <h2 className="sectionTitle">Einstellungen</h2>
        {preferences.map((preference) => (
          <article className="mobileCard" key={preference.id}>
            <strong>{preference.type}</strong>
            <p className="muted">{preference.channel}: {preference.enabled ? "aktiv" : "deaktiviert"}</p>
          </article>
        ))}
        {preferences.length === 0 ? (
          <EmptyState
            title="Standard-Einstellungen aktiv."
            description="Wichtige Nachrichten werden automatisch zugestellt."
          />
        ) : null}
      </section>
    </main>
  );
}
