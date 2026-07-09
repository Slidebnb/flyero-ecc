import Link from "next/link";
import { LeadForm } from "@/app/LeadForm";
import { MarketingPage } from "@/app/marketing";
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
  return (
    <MarketingPage>
      <section className="requestPremiumHero">
        <div className="requestHeroCopy">
          <p className="premiumEyebrow">Verteilung anfragen</p>
          <h1>Erst beraten lassen oder direkt online buchen.</h1>
          <p>
            Wählen Sie den passenden Start: Eine unverbindliche Anfrage funktioniert ohne Registrierung.
            Die direkte Online-Buchung führt zum Kundenkonto mit Auftrag, GPS-Nachweis und Bericht.
          </p>
        </div>
      </section>

      <section className="premiumSection requestChoiceSection" aria-labelledby="request-heading">
        <div className="sectionHeader">
          <div>
            <p className="premiumKicker">Starten</p>
            <h2 id="request-heading">Der einfache Weg zur Verteilung.</h2>
          </div>
          <p>Unverbindlich sprechen oder direkt in die Online-Buchung gehen. Beides führt zu einem nachvollziehbaren Ablauf.</p>
        </div>
        <div className="choiceCards requestChoiceCards">
          <article className="requestLeadLane">
            <span className="premiumIcon" aria-hidden="true">?</span>
            <h3>Unverbindlich anfragen</h3>
            <p>
              Ideal, wenn Gebiet, Auflage, Timing oder Budget noch abgestimmt werden sollen.
              Wir melden uns persönlich und klären den passenden Ablauf.
            </p>
            <LeadForm source="verteilung-anfragen" />
          </article>

          <article className="darkChoice requestBookingLane">
            <span className="premiumIcon" aria-hidden="true">↗</span>
            <h3>Direkt online buchen</h3>
            <p>
              Für konkrete Kampagnen: anmelden, Verteilgebiet auswählen, Preis sehen und den Auftrag strukturiert anlegen.
            </p>
            <ul>
              <li>Verteilgebiet wählen</li>
              <li>Preis sofort sehen</li>
              <li>GPS-Nachweis und Bericht erhalten</li>
            </ul>
            <div className="bookingPath">
              <span>Konto</span>
              <span>Gebiet</span>
              <span>Prüfen</span>
              <span>Buchen</span>
            </div>
            <div className="bookingActions">
              <Link className="premiumButton coral" href={`/register/customer?next=${directBookingParam}`}>Kundenkonto erstellen<span aria-hidden="true">→</span></Link>
              <Link className="premiumButton ghost" href={`/login?next=${directBookingParam}`}>Einloggen und buchen<span aria-hidden="true">→</span></Link>
            </div>
          </article>
        </div>
      </section>
    </MarketingPage>
  );
}
