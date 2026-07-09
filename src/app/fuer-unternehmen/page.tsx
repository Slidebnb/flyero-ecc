import { LeadForm } from "@/app/LeadForm";
import {
  AudienceCard,
  CTAChoiceCard,
  FeatureCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofMockup,
  PremiumFlyerField,
  StepCard,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung für Unternehmen",
  description:
    "Flyerverteilung für Unternehmen: Kampagne anfragen, Gebiet planen, Flyer einlagern und GPS-/Fotobericht erhalten.",
  path: "/fuer-unternehmen",
  keywords: ["Flyerverteilung Unternehmen", "Werbeflyer verteilen", "lokales Marketing"],
});

const reasons = [
  ["Mehr Transparenz", "GPS, Fotos und Admin-Prüfung ersetzen Bauchgefühl.", defaultProofIcons.gps],
  ["Weniger Abstimmung", "Auftrag, Zahlung, Lager und Bericht laufen strukturiert zusammen.", defaultProofIcons.bag],
  ["Besserer Abschluss", "Kunden erhalten Nachweis, PDF und Rechnung im Portal.", defaultProofIcons.report],
] as const;

const audiences = [
  ["Immobilien", "Neubauprojekte, Besichtigungen und Objektkampagnen im passenden Wohnumfeld platzieren.", "Für Makler, Bauträger und Projektentwickler."],
  ["Gastronomie", "Speisekarten, Neueröffnungen und Liefergebiete direkt in relevante Haushalte bringen.", "Für Restaurants, Cafés und Lieferdienste."],
  ["Fitness", "Probetrainings, Kursstarts und Aktionen rund um Studio- oder Vereinsstandorte bewerben.", "Für Studios, Vereine und Gesundheitsanbieter."],
  ["Handwerk", "Leistungen, Notdienste, Jobs und saisonale Angebote lokal sichtbar machen.", "Für regionale Betriebe und Serviceteams."],
  ["Einzelhandel", "Angebote, Neueröffnungen und Rabattaktionen im echten Einzugsgebiet ankündigen.", "Für Geschäfte, Filialen und lokale Marken."],
  ["Events & Vereine", "Feste, Veranstaltungen und Mitgliederwerbung nachvollziehbar verbreiten.", "Für Veranstalter, Vereine und Kommunen."],
] as const;

const steps = [
  ["Anfrage starten", "Projekt, Zielgebiet und Auflage kurz beschreiben."],
  ["Gebiet planen", "Kampagne im Kundenkonto sauber vorbereiten."],
  ["Online bezahlen", "Endpreis prüfen und Auftrag verbindlich buchen."],
  ["GPS-Verteilung", "Touren werden mobil dokumentiert und geprüft."],
  ["Bericht erhalten", "PDF, Fotos und Rechnung im Portal abrufen."],
] as const;

export default function BusinessPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="business-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Für Unternehmen</p>
            <h1 id="business-hero-title">Lokale Kampagnen mit klarer Kontrolle.</h1>
            <p className="mkHeroLead">
              FLYERO verbindet digitale Auftragserstellung, sichere Zahlung, Lagerprozess,
              geprüfte Verteiler und Abschlussbericht in einem nachvollziehbaren Ablauf.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-anfragen">Verteilung anfragen</MarketingButton>
              <MarketingButton href="/preise" variant="ghost">Preise ansehen</MarketingButton>
            </div>
            <div className="mkTrustRow">
              <TrustBadge icon={defaultProofIcons.gps}>GPS-Tourspur</TrustBadge>
              <TrustBadge icon={defaultProofIcons.camera}>Foto-Nachweise</TrustBadge>
              <TrustBadge icon={defaultProofIcons.report}>Kundenbericht</TrustBadge>
            </div>
          </div>
          <ProofMockup area="Koblenz Süd" />
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Warum FLYERO?" title="Flyerverteilung, die im Betrieb nachvollziehbar bleibt.">
        <div className="mkGrid">
          {reasons.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        id="zielgruppen"
        eyebrow="Zielgruppen"
        title="Passend für Branchen, die lokal sichtbar werden müssen."
        intro="Jede Branche bekommt eine klare Nutzenlogik statt generischer Kampagnensprache."
        tone="green"
      >
        <div className="mkGrid">
          {audiences.map(([title, text, signal]) => (
            <AudienceCard key={title} title={title} text={text} signal={signal} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Ablauf" title="Vom Gebiet bis zum geprüften Bericht.">
        <ol className="mkSteps">
          {steps.map(([title, text], index) => (
            <StepCard key={title} title={title} text={text} index={index} />
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection eyebrow="Projekt anfragen" title="Beschreiben Sie kurz Ihre Kampagne.">
        <div className="mkLeadChoiceGrid">
          <article className="mkLeadPanel">
            <LeadForm source="fuer-unternehmen" />
          </article>
          <CTAChoiceCard
            title="Online Buchung ansehen"
            text="Wenn Gebiet, Menge und Timing feststehen, starten Sie direkt im Kundenkonto."
            bullets={["Verteilgebiet wählen", "Preis vor Zahlung prüfen", "Nachweis im Portal erhalten"]}
            href="/login?next=%2Fcustomer%2Forders%2Fnew"
            buttonLabel="Buchung starten"
            tone="dark"
            icon={defaultProofIcons.gps}
          />
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
