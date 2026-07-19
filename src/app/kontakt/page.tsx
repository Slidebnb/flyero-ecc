import { LeadForm } from "@/app/LeadForm";
import {
  CTAChoiceCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProcessPreview,
  PremiumFlyerField,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Kontakt für Flyerverteilung",
  description:
    "Kontakt zu FLYERO aufnehmen: Flyerverteilung anfragen, Verteiler werden, Kooperation besprechen oder Kundenfrage stellen.",
  path: "/kontakt",
  keywords: ["Flyerverteilung Kontakt", "Flyer verteilen Anfrage", "FLYERO Kontakt"],
});

const contactSteps = [
  ["1", "Anfrage senden", "Gebiet, Auflage, Timing oder offene Fragen kurz beschreiben."],
  ["2", "Ablauf klären", "Wir prüfen, ob Beratung, Angebot oder Online-Buchung besser passt."],
  ["3", "Nachweis planen", "GPS, Fotos, Bericht und Rechnung werden passend zum Auftrag vorbereitet."],
] as const;

export default function ContactPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="contact-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Kontakt</p>
            <h1 id="contact-hero-title">Erzählen Sie kurz, was Sie verteilen möchten.</h1>
            <p className="mkHeroLead">
              Wir melden uns zu Ihrer Anfrage. Für registrierte Kunden führt der direkte Weg
              über die Auftragserstellung im Kundenportal.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-anfragen">Verteilung anfragen</MarketingButton>
              <MarketingButton href="/preise" variant="ghost">Preise ansehen</MarketingButton>
            </div>
            <div className="mkTrustRow">
              <TrustBadge icon={defaultProofIcons.shield}>Antwort zum passenden Ablauf</TrustBadge>
              <TrustBadge icon={defaultProofIcons.gps}>GPS-Nachweis möglich</TrustBadge>
            </div>
          </div>
          <ProcessPreview />
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Anfrage" title="Kontakt aufnehmen.">
        <div className="mkLeadChoiceGrid">
          <article className="mkLeadPanel">
            <LeadForm source="kontakt" />
          </article>
          <CTAChoiceCard
            title="Online Buchung ansehen"
            text="Wenn Gebiet, Menge und Zeitraum bereits feststehen, können Sie direkt im Kundenkonto starten."
            bullets={["Konto erstellen", "Gebiet wählen", "Preis prüfen"]}
            href="/login?next=%2Fcustomer%2Forders%2Fnew%3Ffresh%3D1"
            buttonLabel="Buchung starten"
            tone="dark"
            icon={defaultProofIcons.gps}
          />
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Nach dem Absenden" title="So geht es weiter." tone="green">
        <div className="mkContactFlow">
          {contactSteps.map(([number, title, text]) => (
            <article key={title}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
