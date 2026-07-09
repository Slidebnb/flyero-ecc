import { LeadForm } from "@/app/LeadForm";
import {
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  SectionHeader,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

const directBookingNext = "/customer/orders/new";
const directBookingParam = encodeURIComponent(directBookingNext);

export const metadata = createSeoMetadata({
  title: "Flyerverteilung mit GPS-Nachweis anfragen",
  description:
    "Flyerverteilung unverbindlich anfragen oder direkt mit Kundenkonto online buchen. Gebiet, Preis, GPS-Nachweis und Kundenbericht klar geführt planen.",
  path: "/verteilung-anfragen",
  keywords: ["Verteilung anfragen", "Flyer online buchen", "Flyer Kampagne planen", "GPS Nachweis"],
});

export default function DistributionRequestPage() {
  const ShieldIcon = defaultProofIcons.shield;
  const GpsIcon = defaultProofIcons.gps;

  return (
    <MarketingPage>
      <section className="mkRequestHero">
        <PremiumFlyerField />
        <MarketingContainer>
          <p className="mkEyebrow">Verteilung anfragen</p>
          <h1>Erst beraten lassen oder Online-Buchung ansehen.</h1>
          <p>
            Wählen Sie den passenden Start: Eine unverbindliche Anfrage funktioniert ohne Registrierung.
            Die Online-Buchung führt zum Kundenkonto mit Auftrag, GPS-Nachweis und Bericht.
          </p>
        </MarketingContainer>
      </section>

      <MarketingSection>
        <SectionHeader
          eyebrow="Starten"
          title="Der einfache Weg zur Verteilung."
          intro="Unverbindlich sprechen oder direkt in die Online-Buchung gehen. Beides führt zu einem nachvollziehbaren Ablauf."
        />
        <div className="mkLeadChoiceGrid">
          <article className="mkLeadPanel">
            <span className="mkCardIcon" aria-hidden="true">
              <ShieldIcon aria-hidden="true" />
            </span>
            <h3>Unverbindlich anfragen</h3>
            <p>
              Ideal, wenn Gebiet, Auflage, Timing oder Budget noch abgestimmt werden sollen.
              Wir melden uns persönlich und klären den passenden Ablauf.
            </p>
            <LeadForm source="verteilung-anfragen" />
          </article>

          <article className="mkBookingPanel">
            <span className="mkCardIcon" aria-hidden="true">
              <GpsIcon aria-hidden="true" />
            </span>
          <h3>Online Buchung ansehen</h3>
            <p>
              Für konkrete Kampagnen: anmelden, Verteilgebiet auswählen, Preis ansehen und den Auftrag strukturiert anlegen.
            </p>
            <ul>
              <li>Verteilgebiet wählen</li>
              <li>Preis sofort sehen</li>
              <li>GPS-Nachweis und Bericht erhalten</li>
            </ul>
            <div className="mkBookingPath">
              <span>Konto</span>
              <span>Gebiet</span>
              <span>Prüfen</span>
              <span>Buchen</span>
            </div>
            <div className="mkBookingActions">
              <MarketingButton href={`/register/customer?next=${directBookingParam}`} variant="coral">
                Kundenkonto erstellen
              </MarketingButton>
              <MarketingButton href={`/login?next=${directBookingParam}`} variant="ghost">
                Einloggen und ansehen
              </MarketingButton>
            </div>
          </article>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
