import { CtaBand, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "So funktioniert FLYERO",
  description:
    "Der FLYERO Ablauf: Verteilgebiet wählen, Auftrag buchen, Flyer einlagern, Tour dokumentieren und Bericht erhalten.",
  path: "/so-funktionierts",
  keywords: ["Flyerverteilung Ablauf", "Flyer Gebiet planen", "Flyer Bericht"],
});

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Ablauf" title="Ein klarer Prozess vom Auftrag bis zum Bericht.">
        <p>
          FLYERO führt Kunden Schritt für Schritt durch die Verteilung: von der Gebietsauswahl über Lager und Dispatch
          bis zum geprüften Nachweis.
        </p>
      </PageHero>

      <Section title="Der Ablauf im Überblick">
        <StepList
          steps={[
            "Anfragen oder Kundenkonto erstellen",
            "Auftrag und Verteilgebiet anlegen",
            "Preis, Zeitraum und Menge prüfen",
            "Flyer an das Lager senden",
            "Wareneingang per QR-Code erfassen",
            "Verteiler nimmt die Tour an",
            "Pickup und Tour per Smartphone dokumentieren",
            "Admin prüft GPS, Fotos und Status",
            "Kunde erhält Bericht, PDF und Rechnung",
          ]}
        />
      </Section>

      <CtaBand />
    </MarketingPage>
  );
}
