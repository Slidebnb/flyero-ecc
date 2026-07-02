import type { Metadata } from "next";
import { LeadForm } from "@/app/LeadForm";
import { CardGrid, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Für Verteiler - FLYERO",
  description: "Als Verteiler bei FLYERO registrieren, Aufträge per Smartphone annehmen und Touren per GPS dokumentieren.",
};

export default function DistributorPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Für Verteiler"
        title="Flexibel Flyer verteilen - mit klaren Aufgaben."
        primaryHref="/register/distributor"
        primaryLabel="Als Verteiler registrieren"
      >
        <p>
          Verteiler erhalten passende Aufträge, holen Flyer per QR-Code ab und dokumentieren Touren direkt per Smartphone.
          Vor Freischaltung wird jedes Profil geprüft.
        </p>
      </PageHero>

      <Section title="So arbeitest du mit FLYERO">
        <CardGrid items={["Aufträge per App/PWA", "QR-Code-Abholung im Lager", "GPS-gestützte Touren", "klare Aufgaben", "Einsatzgebiet wählen", "mobil per Smartphone nutzbar"]} />
      </Section>

      <Section title="Registrierung und Freischaltung">
        <StepList steps={["Profil anlegen", "Einsatzgebiete und Verfügbarkeit eintragen", "Prüfung durch das Admin-Team", "Nach Freigabe Touren annehmen", "Pickup, Tour und Abschluss dokumentieren"]} />
        <p className="notice">Hinweis: Verteiler werden vor Freischaltung geprüft.</p>
      </Section>

      <Section title="Interesse als Verteiler?">
        <LeadForm defaultType="DISTRIBUTOR" source="fuer-verteiler" />
      </Section>
    </MarketingPage>
  );
}
