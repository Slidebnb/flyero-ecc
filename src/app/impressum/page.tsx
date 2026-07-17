import { MarketingPage, MarketingSection } from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Impressum",
  description: "Impressum und Anbieterkennzeichnung für FLYERO.",
  path: "/impressum",
  keywords: ["FLYERO Impressum"],
});

export default function ImprintPage() {
  return (
    <MarketingPage>
      <MarketingSection eyebrow="Rechtliches" title="Impressum" headingLevel="h1" className="mkLegalPage">
        <div className="legalText">
          <p><strong>Angaben gemäß § 5 DDG</strong></p>
          <p>Flyero Gruppe - Ein Unternehmen der Huwa Gebäudereinigung &amp; Hausmeisterdienste</p>
          <p>Inhaber: Familie Huwa</p>
          <p>Mittelweg 24</p>
          <p>56566 Neuwied</p>
          <p>Deutschland</p>

          <p><strong>Kontakt</strong></p>
          <p>Telefon: 02601 9131820</p>
          <p>E-Mail: <a href="mailto:hallo@flyero.org">hallo@flyero.org</a></p>

          <p><strong>Steuerangaben</strong></p>
          <p>Steuernummer: 32/074/56310</p>

          <p><strong>Redaktionell verantwortlich</strong></p>
          <p>Familie Huwa<br />Mittelweg 24, 56566 Neuwied</p>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
