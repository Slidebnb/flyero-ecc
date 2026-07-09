import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offlineShell">
      <section className="offlinePanel">
        <span className="offlineMark" aria-hidden="true">FL</span>
        <p className="eyebrow">Verteiler-App</p>
        <h1>Offline</h1>
        <p>
          Die Verbindung ist gerade nicht stabil. Bereits geöffnete Touren können lokale GPS-Punkte puffern.
          Neue Daten werden synchronisiert, sobald das iPhone wieder online ist.
        </p>
        <Link href="/distributor/dashboard">Dashboard erneut öffnen</Link>
      </section>
    </main>
  );
}
