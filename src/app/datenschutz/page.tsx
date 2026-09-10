import { MarketingPage, MarketingSection } from "@/app/components/marketing";
import { LegalDocument } from "@/app/components/LegalDocument";
import privacyPolicy from "@/content/datenschutz";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Datenschutz",
  description: "Datenschutzerklärung von FLYERO für Website, Kundenportal, Aufträge, Zahlungen und Nachweise.",
  path: "/datenschutz",
  keywords: ["FLYERO Datenschutz", "Flyerverteilung Datenschutz"],
});

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <MarketingSection eyebrow="Rechtliches" title="Datenschutz" headingLevel="h1" className="mkLegalPage">
        <LegalDocument markdown={privacyPolicy} />
      </MarketingSection>
    </MarketingPage>
  );
}
