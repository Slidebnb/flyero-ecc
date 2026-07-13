import {
  CTAChoiceCard,
  FeatureCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofMockup,
  PremiumFlyerField,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { ServiceType } from "@prisma/client";
import { createSeoMetadata } from "@/app/seo";
import { getPricingSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata = createSeoMetadata({
  title: "Preise für Flyerverteilung",
  description:
    "FLYERO ist eine nachweisbare Premium-Flyerverteilung mit Gebietsauswahl, GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.",
  path: "/preise",
  keywords: ["Flyerverteilung Preise", "Flyer verteilen Kosten", "Werbeflyer Kosten"],
});

const priceFactors = [
  ["Flyeranzahl", "Mehr Stückzahl bedeutet mehr Laufleistung und Logistik.", defaultProofIcons.bag],
  ["Verteilgebiet", "Fläche, Haushalte und Erreichbarkeit beeinflussen den Aufwand.", defaultProofIcons.gps],
  ["Zeitraum", "Expresswünsche oder enge Zeitfenster können Zusatzaufwand erzeugen.", defaultProofIcons.shield],
  ["Zusatzleistungen", "Druckdaten, Lager, Fotos und besondere Vorgaben werden transparent berücksichtigt.", defaultProofIcons.report],
] as const;

const priceDetails = [
  ["Mindestauftrag", "Der aktuelle Mindestauftrag wird aus den aktiven FLYERO-Preisregeln geladen."],
  ["Marginale Staffel", "Die aktuelle Flyer-Staffel wird aus den aktiven FLYERO-Preisregeln geladen."],
  ["Gebiet", "PLZ, Ort oder gezeichnete Fläche bestimmen Planung, Aufwand und Zustellbarkeit."],
  ["Zeitfenster", "Standardverteilung, enge Termine oder Expresswünsche verändern die operative Planung."],
  ["Nachweis", "GPS-Spur, Foto-Dokumentation, Admin-Prüfung und PDF-Bericht sind Teil des Qualitätsprozesses."],
] as const;

export default async function PricingPage() {
  const pricing = await getPricingSettings();
  const distributionRules = pricing.rules
    .filter((rule) => rule.serviceType === ServiceType.FLYER_DISTRIBUTION)
    .sort((left, right) => left.minQuantity - right.minQuantity);
  const minimumOrderValue = distributionRules.length
    ? distributionRules.reduce((minimum, rule) => minimum < rule.minimumNetPrice ? minimum : rule.minimumNetPrice, distributionRules[0].minimumNetPrice)
    : null;
  const formatNet = (value: { toString(): string } | null) => value ? `${Number(value.toString()).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : "auf Anfrage";
  const livePriceDetails = distributionRules.length
    ? [
        ["Mindestauftrag", `${formatNet(minimumOrderValue)} netto inklusive Gebietsplanung, GPS-Nachweis, Foto-Dokumentation und PDF-Bericht.`],
        ["Marginale Staffel", distributionRules.map((rule) => rule.maxQuantity
          ? `Bis ${rule.maxQuantity.toLocaleString("de-DE")} Flyer: ${formatNet(rule.pricePerUnit)} je Flyer.`
          : `Ab ${rule.minQuantity.toLocaleString("de-DE")} Flyern: ${formatNet(rule.pricePerUnit)} je zusätzlichem Flyer.`).join(" ")],
        ["Gebiet", "PLZ, Ort oder gezeichnete Fläche bestimmen Planung, Aufwand und Zustellbarkeit."],
        ["Zeitfenster", "Standardverteilung, enge Termine oder Expresswünsche verändern die operative Planung."],
        ["Nachweis", "GPS-Spur, Foto-Dokumentation, Admin-Prüfung und PDF-Bericht sind Teil des Qualitätsprozesses."],
      ]
    : priceDetails;
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="pricing-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Preise</p>
            <h1 id="pricing-hero-title">Klare Kalkulation vor der Buchung.</h1>
            <p className="mkHeroLead">
              Mindestauftrag {formatNet(minimumOrderValue)} netto inklusive Gebietsplanung, GPS-Nachweis,
              Foto-Dokumentation und PDF-Bericht. Sie sehen die Kosten netto zzgl. MwSt.,
              bevor Sie verbindlich buchen.
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

      <MarketingSection eyebrow="Transparenz" title="Was vor der Buchung geprüft wird." tone="light">
        <div className="mkPriceSystem">
          {livePriceDetails.map(([title, text]) => (
            <article key={title}>
              <span>{title}</span>
              <p>{text}</p>
            </article>
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
