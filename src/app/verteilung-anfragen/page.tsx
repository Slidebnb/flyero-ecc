import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/app/LeadForm";
import { FlyeroLogo, MarketingPage } from "@/app/marketing";

const directBookingNext = "/customer/orders/new";
const directBookingParam = encodeURIComponent(directBookingNext);

export const metadata: Metadata = {
  title: "Verteilung anfragen - FLYERO",
  description: "Flyerverteilung unverbindlich anfragen oder direkt mit Kundenkonto online buchen.",
};

export default function DistributionRequestPage() {
  return (
    <MarketingPage>
      <section className="distributionRequestHero">
        <div className="requestHeroCopy">
          <FlyeroLogo />
          <p className="heroProof">Verteilung anfragen</p>
          <h1>Erst beraten lassen oder direkt online buchen.</h1>
          <p>
            Wählen Sie den schnellsten Weg zu Ihrer Kampagne. Eine Anfrage ist ohne Registrierung möglich,
            die verbindliche Online-Buchung bleibt sauber mit Ihrem Kundenkonto verknüpft.
          </p>
        </div>
      </section>

      <section className="homeStartPanel requestPanel" aria-labelledby="request-heading">
        <p className="heroProof">/verteilung-anfragen</p>
        <h2 id="request-heading">Wie möchten Sie starten?</h2>
        <div className="requestOptions">
          <article className="startChoice light requestLeadCard">
            <span className="choiceIcon" aria-hidden="true">☰</span>
            <h3>Unverbindlich anfragen</h3>
            <p>
              Ideal, wenn Gebiet, Auflage, Timing oder Budget noch abgestimmt werden sollen.
              Wir melden uns persönlich und klären den passenden Ablauf.
            </p>
            <LeadForm source="verteilung-anfragen" />
          </article>

          <article className="startChoice dark requestBookingCard">
            <span className="choiceIcon coral" aria-hidden="true">▦</span>
            <h3>Direkt online buchen</h3>
            <p>
              Für konkrete Kampagnen: anmelden, Verteilgebiet auswählen, Preis sehen und den Auftrag
              direkt strukturiert anlegen.
            </p>
            <ul>
              <li>Verteilgebiet wählen</li>
              <li>Preis sofort sehen</li>
              <li>Auftrag und Zahlung im Portal</li>
            </ul>
            <div className="bookingPath">
              <span>Konto</span>
              <span>Gebiet</span>
              <span>Prüfen</span>
              <span>Buchen</span>
            </div>
            <div className="bookingActions">
              <Link href={`/register/customer?next=${directBookingParam}`}>Kundenkonto erstellen<span aria-hidden="true">→</span></Link>
              <Link href={`/login?next=${directBookingParam}`}>Einloggen und buchen<span aria-hidden="true">→</span></Link>
            </div>
          </article>
        </div>
        <p className="homeStartPrivacy">Datenschutz garantiert. Ihre Daten werden vertraulich behandelt.</p>
      </section>
    </MarketingPage>
  );
}
