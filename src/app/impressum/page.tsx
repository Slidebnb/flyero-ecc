import type { Metadata } from "next";
import { MarketingPage, Section } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Impressum - FLYERO",
  description: "Impressum und Anbieterkennzeichnung für FLYERO.",
};

export default function ImprintPage() {
  return (
    <MarketingPage>
      <Section eyebrow="Rechtliches" title="Impressum">
        <div className="legalText">
          <p><strong>FLYERO GmbH i.G.</strong></p>
          <p>Musterstrasse 1, 56068 Koblenz, Deutschland</p>
          <p>E-Mail: hello@flyero.de</p>
          <p>Telefon: +49 261 000000</p>
          <p>Vertreten durch: Geschaeftsfuehrung der FLYERO GmbH i.G.</p>
          <p>Umsatzsteuer-ID: wird nach Gruendung ergaenzt.</p>
          <p className="notice">Platzhalter: Dieses Impressum muss vor Livegang juristisch und anhand der finalen Unternehmensdaten geprüft werden.</p>
        </div>
      </Section>
    </MarketingPage>
  );
}
