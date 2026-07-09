import { LeadForm } from "@/app/LeadForm";
import {
  CTAChoiceCard,
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
  title: "Kontakt für Flyerverteilung",
  description:
    "Kontakt zu FLYERO aufnehmen: Flyerverteilung anfragen, Verteiler werden, Kooperation besprechen oder Kundenfrage stellen.",
  path: "/kontakt",
  keywords: ["Flyerverteilung Kontakt", "Flyer verteilen Anfrage", "FLYERO Kontakt"],
});

export default function ContactPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="contact-hero-title">
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
          <ProofMockup area="Anfrage" />
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
