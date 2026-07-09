import { MarketingPage } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "AGB",
  description: "Allgemeine Geschäftsbedingungen für FLYERO als Beta-Struktur vor rechtlicher Finalisierung.",
  path: "/agb",
  keywords: ["FLYERO AGB", "Flyerverteilung Bedingungen"],
});

export default function TermsPage() {
  return (
    <MarketingPage>
      <section className="marketingSection legalPage">
        <p className="eyebrow">Rechtliches</p>
        <h1>Allgemeine Geschäftsbedingungen</h1>
        <div className="legalText">
          <p>
            Diese Seite beschreibt künftig die vertraglichen Grundlagen für Auftraggeber, Verteiler,
            Zahlungsabwicklung, Stornierungen, Nachweise, Berichte und Haftungsfragen.
          </p>
          <p>
            Bis zur finalen rechtlichen Freigabe gelten diese Inhalte als strukturierter Beta-Hinweis.
          </p>
          <p className="notice">
            Beta-Hinweis: Die AGB müssen vor echtem Kundenbetrieb anwaltlich erstellt oder geprüft werden.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
