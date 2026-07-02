import type { Metadata } from "next";
import { MarketingPage, Section } from "@/app/marketing";

export const metadata: Metadata = {
  title: "AGB - FLYERO",
  description: "Allgemeine Geschäftsbedingungen für FLYERO als rechtlicher Platzhalter.",
};

export default function TermsPage() {
  return (
    <MarketingPage>
      <Section eyebrow="Rechtliches" title="Allgemeine Geschaeftsbedingungen">
        <div className="legalText">
          <p>
            Diese Seite beschreibt künftig die vertraglichen Grundlagen für Auftraggeber, Verteiler, Zahlungsabwicklung,
            Stornierungen, Nachweise, Berichte und Haftungsfragen.
          </p>
          <p>
            Bis zur finalen rechtlichen Freigabe gelten diese Inhalte nur als Strukturplatzhalter für die Beta-Demo.
          </p>
          <p className="notice">Platzhalter: Die AGB müssen vor echtem Kundenbetrieb anwaltlich erstellt oder geprüft werden.</p>
        </div>
      </Section>
    </MarketingPage>
  );
}
