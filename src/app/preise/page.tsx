import type { Metadata } from "next";
import { CardGrid, CtaBand, MarketingPage, PageHero, Section } from "@/app/marketing";

export const metadata: Metadata = {
  title: "Preise - FLYERO",
  description: "Faire Preise für Flyerverteilung je nach Gebiet, Menge, Zeitraum und Zusatzleistungen.",
};

export default function PricingPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Preise" title="Faire Preise je nach Gebiet und Menge." primaryLabel="Preis berechnen">
        <p>
          Der Endpreis wird im Auftrag automatisch berechnet und vor Zahlung angezeigt. So bleibt die Kalkulation transparent,
          ohne zu früh starre Tabellen zu versprechen.
        </p>
      </PageHero>

      <Section title="Der Preis hängt ab von">
        <CardGrid items={["Flyeranzahl", "Gebiet", "Haushaltsanzahl", "Zeitraum", "Zusatzleistungen", "Expresswunsch"]} />
      </Section>

      <section className="priceHighlight">
        <div>
          <span>Beispielhafte Orientierung</span>
          <strong>ab 0,12 EUR pro Flyer</strong>
          <p>Mindestauftrag ab 250 EUR netto.</p>
        </div>
        <p>
          Der finale Preis wird im Kundenauftrag anhand der aktiven Preisregeln berechnet und vor der Stripe-Zahlung angezeigt.
        </p>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
