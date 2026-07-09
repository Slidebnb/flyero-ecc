import { LeadForm } from "@/app/LeadForm";
import { AudienceList, CtaBand, EditorialList, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung für Unternehmen",
  description:
    "Flyerverteilung für Unternehmen: Kampagne anfragen, Gebiet planen, Flyer einlagern und GPS-/Fotobericht erhalten.",
  path: "/fuer-unternehmen",
  keywords: ["Flyerverteilung Unternehmen", "Werbeflyer verteilen", "lokales Marketing"],
});

export default function BusinessPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Für Unternehmen" title="Flyerverteilung mit klarer Kontrolle." primaryLabel="Verteilung anfragen">
        <p>
          FLYERO verbindet digitale Auftragserstellung, sichere Zahlung, Lagerprozess, geprüfte Verteiler
          und Abschlussbericht in einem nachvollziehbaren Ablauf.
        </p>
      </PageHero>

      <Section title="Warum FLYERO?">
        <EditorialList
          items={[
            ["Mehr Transparenz", "GPS, Fotos und Adminprüfung ersetzen Bauchgefühl."],
            ["Weniger Abstimmung", "Auftrag, Zahlung, Lager und Bericht laufen strukturiert zusammen."],
            ["Besserer Abschluss", "Kunden erhalten Nachweis, PDF und Rechnung im Portal."],
          ]}
        />
      </Section>

      <Section id="zielgruppen" title="Für wen eignet sich FLYERO?">
        <AudienceList
          items={[
            ["Immobilien", "Neubauprojekte, Besichtigungen und Objektkampagnen im passenden Wohnumfeld platzieren.", "Für Makler, Bauträger und Projektentwickler."],
            ["Gastronomie", "Speisekarten, Neueröffnungen und Liefergebiete direkt in relevante Haushalte bringen.", "Für Restaurants, Cafés und Lieferdienste."],
            ["Fitness", "Probetrainings, Kursstarts und Aktionen rund um Studio- oder Vereinsstandorte bewerben.", "Für Studios, Vereine und Gesundheitsanbieter."],
            ["Handwerk", "Leistungen, Notdienste, Jobs und saisonale Angebote lokal sichtbar machen.", "Für regionale Betriebe und Serviceteams."],
            ["Einzelhandel", "Angebote, Neueröffnungen und Rabattaktionen im echten Einzugsgebiet ankündigen.", "Für Geschäfte, Filialen und lokale Marken."],
            ["Events & Vereine", "Feste, Veranstaltungen und Mitgliederwerbung nachvollziehbar verbreiten.", "Für Veranstalter, Vereine und Kommunen."],
          ]}
        />
      </Section>

      <Section title="Ablauf für Auftraggeber">
        <StepList
          steps={[
            "Anfrage stellen oder Konto erstellen",
            "Auftrag und Gebiet anlegen",
            "Endpreis prüfen und bezahlen",
            "Flyer an das Lager senden",
            "Verteilung dokumentiert durchführen",
            "Bericht und Rechnung abrufen",
          ]}
        />
      </Section>

      <Section title="Projekt anfragen">
        <p className="sectionLead">
          Beschreiben Sie kurz Gebiet, Auflage und Ziel. Wir melden uns mit einer passenden Einschätzung.
        </p>
        <LeadForm source="fuer-unternehmen" />
      </Section>

      <CtaBand />
    </MarketingPage>
  );
}
