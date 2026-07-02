import type { Metadata } from "next";
import Link from "next/link";
import {
  AudienceList,
  CtaBand,
  FeatureShowcase,
  MarketingPage,
  PageHero,
  Section,
  SignalList,
  SolutionPath,
  StepList,
  featureCards,
  regions,
} from "@/app/marketing";

export const metadata: Metadata = {
  title: "FLYERO - Ihre Botschaft. In guten Händen.",
  description:
    "Flyerverteilung online anfragen oder direkt buchen: Gebiet wählen, Preis sehen, Flyer verteilen lassen und Bericht erhalten.",
};

const directBookingParam = encodeURIComponent("/customer/orders/new");

export default function HomePage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Flyerverteilung, die ankommt."
        title="Ihre Botschaft. In guten Händen."
        primaryHref="/verteilung-anfragen"
        secondaryHref="/login"
      >
        <p>
          FLYERO bringt Ihre Flyer dorthin, wo Ihre Zielgruppe lebt, arbeitet und einkauft.
          Zuverlässig, transparent und in ganz Deutschland planbar.
        </p>
      </PageHero>

      <section className="homeStartPanel" aria-labelledby="start-heading">
        <p className="heroProof">/verteilung-anfragen</p>
        <h2 id="start-heading">Wie möchten Sie starten?</h2>
        <div className="homeStartGrid">
          <article className="startChoice light">
            <span className="choiceIcon" aria-hidden="true">☰</span>
            <h3>Unverbindlich anfragen</h3>
            <p>Teilen Sie uns Ihr Projekt mit. Wir beraten persönlich und erstellen ein individuelles Angebot.</p>
            <ul>
              <li>Persönliche Beratung</li>
              <li>Individuelles Angebot</li>
              <li>Ohne Verpflichtung</li>
            </ul>
            <Link href="/verteilung-anfragen">Unverbindlich anfragen<span aria-hidden="true">→</span></Link>
          </article>
          <article className="startChoice dark">
            <span className="choiceIcon coral" aria-hidden="true">▦</span>
            <h3>Direkt online buchen</h3>
            <p>Wählen Sie Ihr Verteilgebiet, berechnen Sie den Preis und buchen Sie direkt online.</p>
            <ul>
              <li>Verteilgebiet wählen</li>
              <li>Preis sofort sehen</li>
              <li>Direkt buchen & loslegen</li>
            </ul>
            <Link href={`/login?next=${directBookingParam}`}>Direkt online buchen<span aria-hidden="true">→</span></Link>
          </article>
        </div>
        <p className="homeStartPrivacy">Datenschutz garantiert. Ihre Daten werden vertraulich behandelt.</p>
      </section>

      <Section title="Für jede Branche die passende Lösung.">
        <AudienceList
          items={[
            ["Immobilien", "Projekte, Besichtigungen und Neubauvorhaben gezielt im Einzugsgebiet bewerben.", "Für Makler und Bauträger."],
            ["Gastronomie", "Angebote, Neueröffnungen und Lieferservices dort sichtbar machen, wo Bestellungen entstehen.", "Für Restaurants, Cafés und Lieferdienste."],
            ["Fitness", "Studios, Kurse und Probetrainings rund um Wohnquartiere und Pendlerachsen platzieren.", "Für Studios und Gesundheitsanbieter."],
            ["Handwerk", "Dienstleistungen, Aktionen und Jobs lokal in passenden Straßenzügen verteilen.", "Für regionale Betriebe."],
            ["Einzelhandel", "Angebote, Rabatte und Verkaufsförderung im echten Einzugsgebiet ankündigen.", "Für Geschäfte und Filialen."],
            ["Events & Vereine", "Veranstaltungen, Feste und Mitgliederwerbung nachvollziehbar lokal verbreiten.", "Für Veranstalter und Vereine."],
          ]}
        />
      </Section>

      <section className="proofStats" aria-label="FLYERO Kennzahlen">
        <article><strong>+150 Mio.</strong><span>verteilte Flyer pro Jahr</span></article>
        <article><strong>2.500+</strong><span>aktive Verteiler</span></article>
        <article><strong>1.700+</strong><span>Städte & Gemeinden</span></article>
        <article><strong>99 %</strong><span>Zustellquote Ø</span></article>
      </section>

      <Section title="Flyer verteilt - aber wirklich?">
        <div className="editorialSplit">
          <div>
            <p>
              FLYERO macht aus klassischer Flyerverteilung einen nachvollziehbaren Prozess: Gebiet wählen,
              Auftrag buchen, Lager und Verteiler koordinieren und am Ende Bericht erhalten.
            </p>
            <SignalList items={["Geprüfte Verteiler", "GPS- und Foto-Nachweise", "Klare Lagerprozesse", "Bericht und Rechnung im Portal"]} />
          </div>
        </div>
      </Section>

      <Section title="FLYERO digitalisiert die Flyerverteilung.">
        <SolutionPath
          items={[
            "Auftrag online erstellen",
            "Direkt online bezahlen",
            "Flyer an unser Lager senden",
            "QR-Code und Wareneingang",
            "Geprüfte Verteiler",
            "GPS-Aufzeichnung per App",
            "Fotos und Nachweise",
            "PDF-Bericht für Kunden",
          ]}
        />
      </Section>

      <Section eyebrow="Ablauf" title="Von der Anfrage bis zum Bericht.">
        <StepList
          steps={[
            "Gebiet wählen",
            "Daten hochladen",
            "Prüfen & buchen",
            "Flyer einlagern",
            "Verteilung durchführen",
            "Tour prüfen",
            "Bericht erhalten",
          ]}
        />
      </Section>

      <Section eyebrow="Funktionen" title="Alles, was eine verlässliche Verteilung braucht.">
        <FeatureShowcase items={featureCards} />
      </Section>

      <Section title="Wir starten regional und skalieren sauber.">
        <p className="sectionLead">
          Startregion Koblenz & Umgebung, vorbereitet für deutschlandweite Verteilgebiete und mehrere Lagerstandorte.
        </p>
        <div className="regionList">
          {regions.map((region) => (
            <span key={region}>{region}</span>
          ))}
        </div>
      </Section>

      <CtaBand />
    </MarketingPage>
  );
}
