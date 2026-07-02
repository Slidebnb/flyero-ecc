import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getGoogleMapsConfigStatus } from "@/lib/settings";

export default async function MapsSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const status = await getGoogleMapsConfigStatus();
  return (
    <main className="appShell">
      <header className="topbar"><div><p className="eyebrow">Einstellungen</p><h1>Karten</h1></div><nav className="nav"><Link href="/admin/settings">Zurueck</Link></nav></header>
      <section className="gridCards">
        <article className="card"><strong>{status.browserKeyPresent ? "Ja" : "Nein"}</strong><span>Browser Key vorhanden</span></article>
        <article className="card"><strong>{status.serverKeyPresent ? "Ja" : "Nein"}</strong><span>Server Key vorhanden</span></article>
        <article className="card"><strong>{status.mapsFallbackActive ? "Ja" : "Nein"}</strong><span>Maps Fallback aktiv</span></article>
        <article className="card"><strong>{status.staticMapsAvailable ? "Ja" : "Nein"}</strong><span>Static Maps verfuegbar</span></article>
      </section>
    </main>
  );
}
