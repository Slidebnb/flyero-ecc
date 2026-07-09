import {
  CTAChoiceCard,
  FeatureCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  StepCard,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "So funktioniert FLYERO",
  description:
    "Der FLYERO Ablauf: Verteilgebiet wählen, Auftrag buchen, Flyer einlagern, Tour dokumentieren und Bericht erhalten.",
  path: "/so-funktionierts",
  keywords: ["Flyerverteilung Ablauf", "Flyer Gebiet planen", "Flyer Bericht"],
});

const steps = [
  ["Gebiet wählen", "PLZ, Ort oder Wunschgebiet festlegen."],
  ["Flyer hochladen", "Druckdaten bereitstellen oder Druckoption wählen."],
  ["Online bezahlen", "Preis, Zeitraum und Menge prüfen."],
  ["GPS-Verteilung", "Pickup, Tour und Fotos mobil dokumentieren."],
  ["Bericht erhalten", "Admin-Prüfung, PDF, Fotos und Rechnung abrufen."],
] as const;

const proof = [
  ["Lager & QR", "Wareneingang und Abholung bleiben dem Auftrag zugeordnet.", defaultProofIcons.bag],
  ["Tourdaten", "GPS-Punkte, Zeiten und Statusschritte werden für die Prüfung gespeichert.", defaultProofIcons.gps],
  ["Kundenbericht", "Der Kunde erhält einen freigegebenen Bericht im Portal.", defaultProofIcons.report],
] as const;

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="flow-hero-title">
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Ablauf</p>
            <h1 id="flow-hero-title">Ein klarer Prozess vom Auftrag bis zum Bericht.</h1>
            <p className="mkHeroLead">
              FLYERO führt Kunden Schritt für Schritt durch die Verteilung: von der Gebietsauswahl
              über Lager und Dispatch bis zum geprüften Nachweis.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-anfragen">Verteilung anfragen</MarketingButton>
              <MarketingButton href="/preise" variant="ghost">Preise ansehen</MarketingButton>
            </div>
            <div className="mkTrustRow">
              <TrustBadge icon={defaultProofIcons.gps}>GPS-Verteilung</TrustBadge>
              <TrustBadge icon={defaultProofIcons.report}>PDF-Bericht</TrustBadge>
            </div>
          </div>
          <div className="mkProofMockup" aria-hidden="true" />
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Der Ablauf" title="Fünf Schritte, keine Formularwüste." tone="green">
        <ol className="mkSteps">
          {steps.map(([title, text], index) => (
            <StepCard key={title} title={title} text={text} index={index} />
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection eyebrow="Nachweis" title="Was am Ende wirklich geprüft wird.">
        <div className="mkGrid">
          {proof.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="mkChoiceGrid">
          <CTAChoiceCard
            title="Unverbindlich anfragen"
            text="Wenn Gebiet, Auflage oder Timing noch offen sind."
            bullets={["Beratung erhalten", "Ablauf klären", "Ohne Registrierung starten"]}
            href="/verteilung-anfragen"
            buttonLabel="Anfrage starten"
            icon={defaultProofIcons.shield}
          />
          <CTAChoiceCard
            title="Direkt online buchen"
            text="Wenn die Kampagne konkret ist und der Auftrag direkt angelegt werden soll."
            bullets={["Konto nutzen", "Gebiet wählen", "Preis prüfen"]}
            href="/login?next=%2Fcustomer%2Forders%2Fnew"
            buttonLabel="Direkt buchen"
            tone="dark"
            icon={defaultProofIcons.gps}
          />
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
