import type { Metadata } from "next";
import { MarketingPage, Section } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Datenschutz - FLYERO",
  description: "Datenschutzinformationen für FLYERO als Platzhalter vor anwaltlicher Prüfung.",
};

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <Section eyebrow="Rechtliches" title="Datenschutz">
        <div className="legalText">
          <p>
            FLYERO verarbeitet personenbezogene Daten zur Bereitstellung der Plattform, zur Bearbeitung von Anfragen, zur
            Auftragserstellung, Zahlung, Lagerabwicklung, Tourdokumentation und Berichtserstellung.
          </p>
          <p>
            Dazu können Kontakt-, Vertrags-, Zahlungs-, Rollen-, Standort- und Nachweisdaten gehören. Die Verarbeitung erfolgt
            zweckgebunden und mit rollenbasierter Zugriffsbeschraenkung.
          </p>
          <p>
            Externe Dienstleister wie Zahlungsanbieter werden nur eingesetzt, wenn sie für den jeweiligen Prozess erforderlich sind.
          </p>
          <p className="notice">Platzhalter: Die Datenschutzerklärung muss vor Livegang anwaltlich geprüft und um finale Anbieter, Auftragsverarbeiter und Speicherfristen ergänzt werden.</p>
        </div>
      </Section>
    </MarketingPage>
  );
}
