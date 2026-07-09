import { LeadForm } from "@/app/LeadForm";
import { MarketingPage, PageHero, Section } from "@/app/marketing";
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
      <PageHero eyebrow="Kontakt" title="Erzählen Sie kurz, was Sie verteilen möchten." secondaryHref="/preise" secondaryLabel="Preise ansehen">
        <p>
          Wir melden uns zu Ihrer Anfrage. Für registrierte Kunden führt der direkte Weg über die Auftragserstellung im Kundenportal.
        </p>
      </PageHero>

      <Section title="Anfrage senden">
        <LeadForm source="kontakt" />
      </Section>
    </MarketingPage>
  );
}
