import {
  CTAChoiceCard,
  FeatureCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofMockup,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Preise für Flyerverteilung",
  description:
    "FLYERO Preise richten sich nach Gebiet, Flyeranzahl, Haushalten, Zeitraum und Zusatzleistungen. Der Preis wird vor der Buchung angezeigt.",
  path: "/preise",
  keywords: ["Flyerverteilung Preise", "Flyer verteilen Kosten", "Werbeflyer Kosten"],
});

const priceFactors = [
  ["Flyeranzahl", "Mehr Stückzahl bedeutet mehr Laufleistung und Logistik.", defaultProofIcons.bag],
  ["Verteilgebiet", "Fläche, Haushalte und Erreichbarkeit beeinflussen den Aufwand.", defaultProofIcons.gps],
  ["Zeitraum", "Expresswünsche oder enge Zeitfenster können Zusatzaufwand erzeugen.", defaultProofIcons.shield],
  ["Zusatzleistungen", "Druckdaten, Lager, Fotos und besondere Vorgaben werden transparent berücksichtigt.", defaultProofIcons.report],
] as const;

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="pricing-hero-title">
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Preise</p>
            <h1 id="pricing-hero-title">Klare Kalkulation vor der Buchung.</h1>
            <p className="mkHeroLead">
              Der Endpreis wird im Auftrag anhand von Gebiet, Menge, Zeitraum und Zusatzleistungen berechnet.
              Sie sehen die Kosten, bevor Sie verbindlich buchen.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-anfragen">Preis anfragen</MarketingButton>
              <MarketingButton href="/login?next=%2Fcustomer%2Forders%2Fnew" variant="ghost">Online Buchung ansehen</MarketingButton>
            </div>
            <div className="mkTrustRow">
              <TrustBadge icon={defaultProofIcons.report}>Preis vor Zahlung</TrustBadge>
              <TrustBadge icon={defaultProofIcons.gps}>Gebietsbasiert</TrustBadge>
            </div>
          </div>
          <ProofMockup area="Preisprüfung" />
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Preislogik" title="Wovon der Preis abhängt.">
        <div className="mkGrid mkGrid-4">
          {priceFactors.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="green">
        <div className="mkChoiceGrid">
          <CTAChoiceCard
            title="Unverbindlich kalkulieren lassen"
            text="Für individuelle Kampagnen mit Gebiet, Zeitraum, Druck oder besonderem Ablauf."
            bullets={["Persönliche Einschätzung", "Keine Registrierung nötig", "Passende Startempfehlung"]}
            href="/verteilung-anfragen"
            buttonLabel="Anfrage senden"
            icon={defaultProofIcons.shield}
          />
          <CTAChoiceCard
            title="Direkt im Auftrag berechnen"
            text="Für konkrete Buchungen wird der Preis im Kundenportal vor der Zahlung angezeigt."
            bullets={["Gebiet wählen", "Menge prüfen", "Preis vor Buchung sehen"]}
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
