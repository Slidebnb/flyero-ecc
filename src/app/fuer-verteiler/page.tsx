import { LeadForm } from "@/app/LeadForm";
import { EditorialList, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Als Verteiler bei FLYERO starten",
  description:
    "Als Verteiler registrieren, Aufträge annehmen, Flyer per QR-Code abholen und Touren per Smartphone dokumentieren.",
  path: "/fuer-verteiler",
  keywords: ["Flyer verteilen Job", "Verteiler werden", "Nebenjob Flyer verteilen"],
});

export default function DistributorPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Für Verteiler"
        title="Flexibel verteilen, klar dokumentieren."
        primaryHref="/register/distributor"
        primaryLabel="Als Verteiler registrieren"
      >
        <p>
          Verteiler erhalten passende Touren, holen Flyer per QR-Code ab und dokumentieren die Verteilung direkt per Smartphone.
          Vor Freischaltung wird jedes Profil geprüft.
        </p>
      </PageHero>

      <Section title="So arbeitest du mit FLYERO">
        <EditorialList
          items={[
            "Touren im Portal ansehen",
            "Einsatzgebiet passend wählen",
            "QR-Code-Abholung im Lager",
            "GPS-gestützte Touren",
            "Fotos als Nachweis",
            "Mobil per Smartphone nutzbar",
          ]}
        />
      </Section>

      <Section title="Registrierung und Freischaltung">
        <StepList
          steps={[
            "Profil anlegen",
            "Einsatzgebiete und Verfügbarkeit eintragen",
            "Prüfung durch das Admin-Team",
            "Nach Freigabe Touren annehmen",
            "Pickup, Tour und Abschluss dokumentieren",
          ]}
        />
        <p className="notice">Hinweis: Verteiler werden vor der Freischaltung geprüft.</p>
      </Section>

      <Section title="Interesse als Verteiler?">
        <LeadForm defaultType="DISTRIBUTOR" source="fuer-verteiler" />
      </Section>
    </MarketingPage>
  );
}
