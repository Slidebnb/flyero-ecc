import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/app/LeadForm";
import { MarketingPage, Section } from "@/app/marketing";

const directBookingNext = "/customer/orders/new";
const directBookingParam = encodeURIComponent(directBookingNext);

export const metadata: Metadata = {
  title: "Verteilung anfragen - FLYERO",
  description:
    "Flyerverteilung unverbindlich anfragen oder mit Kundenkonto direkt online buchen.",
};

export default function DistributionRequestPage() {
  return (
    <MarketingPage>
      <section className="requestHero">
        <div>
          <p className="heroProof">Verteilung anfragen</p>
          <h1>Erst einschätzen lassen oder direkt online buchen.</h1>
          <p>
            Du entscheidest, wie konkret es schon ist: Anfrage ohne Konto senden oder anmelden und den Flyerauftrag direkt
            im Kundenportal anlegen.
          </p>
          <div className="requestHeroChoices" aria-label="Verteilungsanfrage Optionen">
            <span>Öffentliche Anfrage ohne Registrierung</span>
            <span>Direktbuchung mit Kundenkonto</span>
            <span>Auftrag, Zahlung und Bericht im Portal</span>
          </div>
        </div>
      </section>

      <Section title="Wähle deinen Weg.">
        <div className="requestDecisionGrid" aria-label="Entscheidungshilfe">
          <article>
            <strong>Noch nicht sicher?</strong>
            <p>Schick uns Gebiet, Auflage und Ziel. Wir melden uns zur Einschätzung.</p>
          </article>
          <article>
            <strong>Kampagne steht?</strong>
            <p>Registrieren, einloggen und den Auftrag direkt strukturiert buchen.</p>
          </article>
          <article>
            <strong>Schon Kunde?</strong>
            <p>Login mit Rücksprung zur Auftragserstellung nutzen.</p>
          </article>
        </div>

        <div className="requestOptions">
          <article className="requestOption requestOptionPrimary">
            <div>
              <span className="requestOptionNumber">01</span>
              <h3>Unverbindlich anfragen</h3>
              <p>
                Ideal, wenn du erst Preis, Gebiet, Auflage oder Ablauf klären möchtest. Die Anfrage bleibt öffentlich,
                eine Registrierung ist dafür nicht nötig.
              </p>
            </div>
            <LeadForm source="verteilung-anfragen" />
          </article>

          <article className="requestOption requestOptionBooking">
            <div>
              <span className="requestOptionNumber">02</span>
              <h3>Direkt online buchen</h3>
              <p>
                Für konkrete Kampagnen: Konto erstellen oder einloggen und danach direkt zur geschützten Auftragserstellung
                springen.
              </p>
            </div>
            <div className="bookingPath">
              <span>Konto</span>
              <span>Auftrag</span>
              <span>Zahlung</span>
              <span>Nachweis</span>
            </div>
            <div className="bookingActions">
              <Link href={`/register/customer?next=${directBookingParam}`}>
                Kundenkonto erstellen
              </Link>
              <Link href={`/login?next=${directBookingParam}`}>
                Einloggen und buchen
              </Link>
              <Link className="textLink" href={directBookingNext}>
                Auftragserstellung öffnen
              </Link>
            </div>
            <ul className="bookingFacts">
              <li>Online-Auftrag, Gebiet und Auflage strukturiert erfassen</li>
              <li>Zahlung und Rechnung bleiben sauber am Kundenkonto</li>
              <li>Berichte, PDFs und Nachrichten später im Portal abrufen</li>
            </ul>
          </article>
        </div>
      </Section>
    </MarketingPage>
  );
}
