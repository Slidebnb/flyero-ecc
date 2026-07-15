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
      <MarketingSection eyebrow="Rechtliches" title="Impressum" className="mkLegalPage">
        <div className="legalText">
          <p><strong>FLYERO GmbH i.G.</strong></p>
          <p>Musterstraße 1, 56068 Koblenz, Deutschland</p>
          <p>E-Mail: hallo@flyero.org</p>
          <p>Telefon: +49 261 000000</p>
          <p>Vertreten durch die Geschäftsführung der FLYERO GmbH i.G.</p>
          <p>Umsatzsteuer-ID wird nach Gründung ergänzt.</p>
          <p className="notice">
            Beta-Hinweis: Dieses Impressum muss vor dem Livegang anhand der finalen Unternehmensdaten geprüft werden.
          </p>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
