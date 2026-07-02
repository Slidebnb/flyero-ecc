import type { Metadata } from "next";
import { CtaBand, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";

export const metadata: Metadata = {
  title: "So funktioniert's - FLYERO",
  description: "Der komplette FLYERO Ablauf von Account und Auftrag bis GPS-Tour, Bericht und Rechnung.",
};

export default function HowItWorksPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Ablauf" title="Ein klarer Prozess vom Auftrag bis zum Bericht.">
        <p>
          FLYERO macht jeden Schritt der Flyerverteilung nachvollziehbar: Auftrag, Zahlung, Lager, Dispatch, Tour und Bericht
          greifen in einem Portal ineinander.
        </p>
      </PageHero>

      <Section title="Detaillierter Ablauf">
        <StepList
          steps={[
            "Account erstellen",
            "Auftrag erstellen",
            "Gebiet auswählen",
            "online bezahlen",
            "Adminprüfung",
            "Flyer einsenden",
            "Lager checkt Flyer ein",
            "Verteiler holt Flyer per QR-Code ab",
            "Tour wird per GPS aufgezeichnet",
            "Admin prüft",
            "Kunde erhält Bericht und Rechnung",
          ]}
        />
      </Section>

      <CtaBand />
    </MarketingPage>
  );
}
