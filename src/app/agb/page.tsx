import { MarketingPage, MarketingSection } from "@/app/components/marketing";
import { LegalDocument } from "@/app/components/LegalDocument";
import terms from "@/content/agb";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen von FLYERO für gewerbliche Auftraggeber und Organisationen.",
  path: "/agb",
  keywords: ["FLYERO AGB", "Flyerverteilung Bedingungen"],
});

export default function TermsPage() {
  return (
    <MarketingPage>
      <MarketingSection eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen" headingLevel="h1" className="mkLegalPage">
        <LegalDocument markdown={terms} />
      </MarketingSection>
    </MarketingPage>
  );
}
