import { CtaBand, EditorialList, MarketingPage, PageHero, Section } from "@/app/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Preise für Flyerverteilung",
  description:
    "FLYERO Preise richten sich nach Gebiet, Flyeranzahl, Haushalten, Zeitraum und Zusatzleistungen. Der Preis wird vor der Buchung angezeigt.",
  path: "/preise",
  keywords: ["Flyerverteilung Preise", "Flyer verteilen Kosten", "Werbeflyer Kosten"],
});

export default function PricingPage() {
  return (
    <MarketingPage>
      <PageHero eyebrow="Preise" title="Klare Kalkulation vor der Buchung." primaryLabel="Preis berechnen">
        <p>
          Der Endpreis wird im Auftrag anhand von Gebiet, Menge, Zeitraum und Zusatzleistungen berechnet.
          Sie sehen die Kosten, bevor Sie verbindlich buchen.
        </p>
      </PageHero>

      <Section title="Wovon der Preis abhängt">
        <EditorialList
          items={[
            ["Flyeranzahl", "Mehr Stückzahl bedeutet mehr Laufleistung und Logistik."],
            ["Verteilgebiet", "Fläche, Haushalte und Erreichbarkeit beeinflussen den Aufwand."],
            ["Zeitraum", "Expresswünsche oder enge Zeitfenster können Zusatzaufwand erzeugen."],
            ["Zusatzleistungen", "Druckdaten, Lager, Fotos und besondere Vorgaben werden transparent berücksichtigt."],
          ]}
        />
      </Section>

      <section className="priceHighlight">
        <div>
          <span>Orientierung</span>
          <strong>ab 0,12 EUR pro Flyer</strong>
          <p>Mindestauftrag ab 250 EUR netto.</p>
        </div>
        <p>
          Die konkrete Kalkulation entsteht im Kundenauftrag aus den aktiven Preisregeln und wird vor der Zahlung angezeigt.
        </p>
      </section>

      <CtaBand />
    </MarketingPage>
  );
}
