import { UserRole } from "@prisma/client";
import { AdminPortalShell } from "@/app/admin/AdminPortalShell";
import { DataSection } from "@/app/PortalComponents";
import { requireRole } from "@/lib/auth";
import { getGoogleMapsConfigStatus } from "@/lib/settings";

export default async function MapsSettingsPage() {
  await requireRole([UserRole.ADMIN]);
  const status = await getGoogleMapsConfigStatus();

  return (
    <AdminPortalShell
      eyebrow="Einstellungen"
      title="Karten"
      description="Google Maps Browser-Key, Server-Key und Fallback-Status auf einen Blick."
    >
      <DataSection title="Maps-Konfiguration">
        <section className="gridCards">
          <article className="card"><strong>{status.browserKeyPresent ? "Ja" : "Nein"}</strong><span>Browser Key vorhanden</span></article>
          <article className="card"><strong>{status.serverKeyPresent ? "Ja" : "Nein"}</strong><span>Server Key vorhanden</span></article>
          <article className="card"><strong>{status.mapsFallbackActive ? "Ja" : "Nein"}</strong><span>Maps Fallback aktiv</span></article>
          <article className="card"><strong>{status.staticMapsAvailable ? "Ja" : "Nein"}</strong><span>Static Maps verfügbar</span></article>
        </section>
      </DataSection>
    </AdminPortalShell>
  );
}
