import type { Metadata } from "next";
import { LeadForm } from "@/app/LeadForm";
import { CardGrid, CtaBand, MarketingPage, PageHero, Section, StepList } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Für Unternehmen - FLYERO",
  description: "Flyerverteilung für Unternehmen online anfragen, bezahlen und mit GPS- und Fotobericht nachweisen lassen.",
};

export default function BusinessPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Für Unternehmen" title="Flyerverteilung mit klarer Kontrolle." primaryLabel="Jetzt Verteilung anfragen">
        <p>
          FLYERO verbindet digitale Auftragserstellung, Vorkasse per Stripe, Lagerprozess, geprüfte Verteiler und
          Abschlussbericht in einem nachvollziehbaren Ablauf.
        </p>
      </PageHero>

      <Section title="Warum FLYERO?">
        <CardGrid items={[["Mehr Transparenz", "GPS, Fotos und Adminprüfung ersetzen Bauchgefühl."], ["Weniger Abstimmung", "Auftrag, Zahlung, Lager und Bericht laufen strukturiert."], ["Besserer Abschluss", "Kunden erhalten Bericht und Rechnung im Portal."]]} />
      </Section>

      <Section title="Für wen geeignet?">
        <CardGrid items={["Immobilienmakler", "Restaurants und Lieferdienste", "Fitnessstudios", "Handwerksbetriebe", "Einzelhandel", "Franchise-Unternehmen"]} />
      </Section>

      <Section title="Ablauf für Auftraggeber">
        <StepList steps={["Account erstellen", "Auftrag und Gebiet anlegen", "Endpreis prüfen und per Stripe bezahlen", "Flyer an das Lager senden", "Verteilung wird geprüft und dokumentiert", "Bericht und Rechnung im Portal abrufen"]} />
      </Section>

      <Section title="Nachweise und Zahlung">
        <p className="sectionLead">
          FLYERO arbeitet mit Vorkasse über Stripe. Nach Abschluss prüft das Admin-Team die Tourdaten und stellt den GPS- und Fotobericht bereit.
        </p>
      </Section>

      <Section title="Kontaktformular">
        <LeadForm source="fuer-unternehmen" />
      </Section>

      <CtaBand />
    </MarketingPage>
  );
}
