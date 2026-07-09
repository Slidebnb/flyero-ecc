import { MarketingPage } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Datenschutz",
  description: "Datenschutzinformationen für FLYERO: Anfragen, Aufträge, Zahlungsdaten, Tourdaten und Nachweise.",
  path: "/datenschutz",
  keywords: ["FLYERO Datenschutz", "Flyerverteilung Datenschutz"],
});

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <section className="marketingSection legalPage">
        <p className="eyebrow">Rechtliches</p>
        <h1>Datenschutz</h1>
        <div className="legalText">
          <p>
            FLYERO verarbeitet personenbezogene Daten zur Bereitstellung der Plattform, zur Bearbeitung von Anfragen,
            zur Auftragserstellung, Zahlung, Lagerabwicklung, Tourdokumentation und Berichtserstellung.
          </p>
          <p>
            Dazu können Kontakt-, Vertrags-, Zahlungs-, Rollen-, Standort- und Nachweisdaten gehören. Der Zugriff ist
            rollenbasiert beschränkt.
          </p>
          <p>
            Externe Dienstleister wie Zahlungsanbieter werden nur eingesetzt, wenn sie für den jeweiligen Prozess erforderlich sind.
          </p>
          <p className="notice">
            Beta-Hinweis: Die Datenschutzerklärung muss vor Livegang anwaltlich geprüft und um finale Anbieter,
            Auftragsverarbeiter und Speicherfristen ergänzt werden.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
