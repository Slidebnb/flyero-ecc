import type { Metadata } from "next";
import { LeadForm } from "@/app/LeadForm";
import { MarketingPage, PageHero, Section } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Kontakt - FLYERO",
  description: "Kontakt zu FLYERO aufnehmen: Flyerverteilung, Verteiler-Registrierung, Kooperation oder allgemeine Anfrage.",
};

export default function ContactPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Kontakt" title="Erzähl uns kurz, was du verteilen möchtest." secondaryHref="/preise" secondaryLabel="Preise ansehen">
        <p>
          Wir melden uns zu deiner Anfrage. Für registrierte Kunden führt der direkte Weg über den Auftrag im Kundenportal.
        </p>
      </PageHero>

      <Section title="Anfrage senden">
        <LeadForm source="kontakt" />
      </Section>
    </MarketingPage>
  );
}
