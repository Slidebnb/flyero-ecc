import type { Metadata } from "next";
import Link from "next/link";
import {
  AudienceList,
  CtaBand,
  FeatureShowcase,
  MarketingPage,
  PageHero,
  ProblemVisual,
  Section,
  SignalList,
  SolutionPath,
  StepList,
  featureCards,
  regions,
} from "@/app/marketing";

export const metadata: Metadata = {
  title: "FLYERO - Flyerverteilung mit GPS-Nachweis",
  description:
    "Flyerverteilung online buchen, per Stripe bezahlen und nach Abschluss einen professionellen GPS- und Fotobericht erhalten. Start im Raum Koblenz.",
};

export default function HomePage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Moderne Flyerverteilung mit GPS-Nachweis"
        title="Flyerverteilung, die man nachweisen kann."
        primaryHref="/verteilung-anfragen"
        secondaryHref="/register/distributor"
        secondaryLabel="Verteiler werden"
      >
        <p>
          Mit FLYERO buchen Unternehmen ihre Flyerverteilung online, bezahlen direkt sicher per Stripe und erhalten nach der
          Verteilung einen professionellen GPS- und Fotobericht.
        </p>
        <span className="trustPill">Startregion Koblenz & Umgebung.</span>
      </PageHero>

      <Section title="Flyer verteilt - aber wirklich?">
        <div className="editorialSplit">
          <div>
            <p>
              Klassische Flyerverteilung endet oft mit Unsicherheit: viel Abstimmung, wenig Beleg, kaum Transparenz. FLYERO
              macht daraus einen prüfbaren Prozess.
            </p>
            <SignalList items={["keine klare Kontrolle", "unzuverlässige Austräger", "keine GPS-Dokumentation", "viel Abstimmung per Telefon und E-Mail", "kein professioneller Abschlussbericht"]} />
          </div>
          <ProblemVisual />
        </div>
      </Section>

      <Section title="FLYERO digitalisiert die Flyerverteilung.">
        <SolutionPath
          items={[
            "Auftrag online erstellen",
            "direkt online bezahlen",
            "Flyer an unser Lager senden",
            "QR-Code und Lagerprozess",
            "geprüfte Verteiler",
            "GPS-Aufzeichnung per Verteiler-App",
            "Fotos und Nachweise",
            "PDF-Bericht für Kunden",
          ]}
        />
      </Section>

      <Section eyebrow="Ablauf" title="Von der Anfrage bis zum Bericht.">
        <StepList
          steps={[
            "Auftrag erstellen",
            "Online bezahlen",
            "Admin prüft Auftrag",
            "Flyer an Lager senden",
            "Verteiler wird zugewiesen",
            "GPS-gestützte Verteilung",
            "Bericht erhalten",
          ]}
        />
      </Section>

      <Section eyebrow="Funktionen" title="Alles, was eine nachweisbare Verteilung braucht.">
        <FeatureShowcase items={featureCards} />
      </Section>

      <Section eyebrow="Zielgruppen" title="Für Branchen, die lokal sichtbar werden müssen.">
        <p className="sectionLead audienceLead">
          Nicht jede Kampagne braucht dieselbe Route. FLYERO verbindet Zielgebiet, Zeitfenster und Nachweis zu einer Verteilung, die zur Branche passt.
        </p>
        <AudienceList
          items={[
            [
              "Immobilien",
              "Exposés, Suchprofile und Eigentümeransprache dort verteilen, wo Bestandsobjekte, Kaufkraft und Zielhaushalte zusammenkommen.",
              "Für Makler, Bauträger und Hausverwaltungen.",
            ],
            [
              "Gastronomie",
              "Liefergebiete, Mittagstisch und Neueröffnungen in den Straßenzügen bewerben, aus denen reale Bestellungen entstehen.",
              "Für Restaurants, Lieferdienste, Cafés und Bars.",
            ],
            [
              "Fitness & Gesundheit",
              "Probetrainings, Kursstarts und lokale Aktionen rund um Wohnquartiere, Büros und Pendlerachsen sichtbar machen.",
              "Für Studios, Praxen, Kurse und Wellness-Angebote.",
            ],
            [
              "Handwerk",
              "Saisonale Leistungen wie Dach, Garten, Heizung, Solar oder Sanierung in passenden Häuserblöcken und Ortsteilen platzieren.",
              "Für Betriebe mit regionalem Einsatzgebiet.",
            ],
            [
              "Einzelhandel",
              "Aktionen, Neueröffnungen und Standortangebote im echten Einzugsgebiet ankündigen, nicht nur im digitalen Feed.",
              "Für Geschäfte, Filialen und lokale Marken.",
            ],
            [
              "Events & Vereine",
              "Termine, Kurse und Veranstaltungen mit nachvollziehbarer Reichweite in Stadtteilen und Nachbarorten bekannt machen.",
              "Für Veranstalter, Vereine und kommunale Aktionen.",
            ],
          ]}
        />
      </Section>

      <Section title="Wir starten regional.">
        <p className="sectionLead">
          FLYERO startet im Raum Koblenz und Umgebung. So können wir Qualität, Lagerprozesse und Verteiler zuverlässig kontrollieren.
        </p>
        <div className="regionList">
          {regions.map((region) => (
            <span key={region}>{region}</span>
          ))}
        </div>
      </Section>

      <CtaBand />

      <section className="marketingSection compactSection">
        <p className="muted">
          Bereits registriert? <Link className="textLink" href="/login">Zum Login</Link>
        </p>
      </section>
    </MarketingPage>
  );
}
