import Link from "next/link";
import { UserRole } from "@prisma/client";
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
    <main className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Kundenportal</p>
          <h1>Nachrichten</h1>
        </div>
        <nav className="nav">
          <Link href="/customer/dashboard">Dashboard</Link>
          <Link href="/customer/orders">Auftraege</Link>
          <Link href="/customer/profile">Profil</Link>
        </nav>
      </header>

      <section className="panel stack widePanel">
        <h2 className="sectionTitle">Filter</h2>
        <form className="form grid" action="/customer/notifications" method="get">
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

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">Nachrichtenzentrale</h2>
        {messages.map((message) => (
          <article key={message.id} className="stack" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
            <div className="splitHeader">
              <div>
                <strong>{message.subject}</strong>
                <p className="muted">{message.type} / {formatDateTime(message.createdAt)} / {message.readAt ? "gelesen" : "ungelesen"}</p>
              </div>
              <span className={message.readAt ? "badge success" : "badge warning"}>{message.readAt ? "Gelesen" : "Neu"}</span>
            </div>
            <p>{message.body}</p>
            <small className="muted">Queue: {message.queues[0]?.status ?? "nicht geplant"}</small>
          </article>
        ))}
        {messages.length === 0 ? <p className="muted">Keine Nachrichten gefunden.</p> : null}
      </section>

      <section className="panel stack widePanel" style={{ marginTop: 18 }}>
        <h2 className="sectionTitle">E-Mail-Einstellungen</h2>
        {preferences.map((preference) => (
          <p key={preference.id}><strong>{preference.type}</strong><br />{preference.channel}: {preference.enabled ? "aktiv" : "deaktiviert"}</p>
        ))}
        {preferences.length === 0 ? <p className="muted">Noch keine individuellen Einstellungen gespeichert. Standard: wichtige Nachrichten aktiv.</p> : null}
      </section>
    </main>
  );
}
