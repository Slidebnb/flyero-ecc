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
  const ReportIcon = defaultProofIcons.report;

  return (
    <MarketingPage>
      <section className="mkRequestHero">
        <PremiumFlyerField />
        <MarketingContainer>
          <p className="mkEyebrow">Verteilung anfragen</p>
          <h1>Online buchen, Angebot anfragen oder klassisch senden.</h1>
          <p>
            Wählen Sie den passenden Start: direkt online buchen und bezahlen, unverbindlich anfragen
            oder das Anfrageformular klassisch per E-Mail senden.
          </p>
        </MarketingContainer>
      </section>

      <MarketingSection>
        <SectionHeader
          eyebrow="Starten"
          title="Drei Wege zur FLYERO Verteilung."
          intro="Direkte Buchung, persönliche Rückmeldung oder klassischer Formularweg. Jeder Weg führt zu GPS-Nachweis, Foto-Dokumentation und PDF-Bericht nach Abschluss."
        />
        <div className="mkLeadChoiceGrid mkLeadChoiceGridThree">
          <article className="mkBookingPanel">
            <span className="mkCardIcon" aria-hidden="true">
              <GpsIcon aria-hidden="true" />
            </span>
            <h3>Direkt online buchen</h3>
            <p>
              Gebiet wählen, Flyerzahl sehen, Preis prüfen und direkt bezahlen. FLYERO prüft Gebiet und Druckdaten final.
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
                Einloggen und buchen
              </MarketingButton>
            </div>
          </article>

          <article className="mkLeadPanel">
            <span className="mkCardIcon" aria-hidden="true">
              <ShieldIcon aria-hidden="true" />
            </span>
            <h3>Unverbindlich anfragen</h3>
            <p>
              Wir prüfen dein Gebiet und melden uns mit einer Rückmeldung zu Preis, Ablauf und Druckdaten.
            </p>
            <LeadForm source="verteilung-anfragen" />
          </article>

          <article className="mkClassicPanel">
            <span className="mkCardIcon" aria-hidden="true">
              <ReportIcon aria-hidden="true" />
            </span>
            <h3>Anfrageformular nutzen</h3>
            <p>
              Lieber klassisch anfragen? Lade das Formular herunter oder sende uns die Eckdaten direkt per E-Mail.
            </p>
            <div className="mkBookingActions">
              <MarketingButton href="/downloads/flyero-anfrageformular.html" variant="ghost">
                Anfrageformular herunterladen
              </MarketingButton>
              <MarketingButton href="mailto:anfrage@flyero.de?subject=Flyerverteilung%20anfragen" variant="ghost">
                Per E-Mail anfragen
              </MarketingButton>
            </div>
          </article>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
