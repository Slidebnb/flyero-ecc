import { LeadForm } from "@/app/LeadForm";
import { Mail, ShieldCheck } from "lucide-react";
import {
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  SectionHeader,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";
import { getPublicPrintMessage } from "@/lib/publicCapabilities";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung einfach anfragen | FLYERO",
  description:
    "Flyerverteilung unkompliziert anfragen: Gebiet, Menge und Zeitraum nennen, Rückmeldung erhalten und die nächsten Schritte gemeinsam festlegen.",
  path: "/verteilung-anfragen",
  keywords: ["Verteilung anfragen", "Flyer verteilen lassen", "Flyerkampagne planen", "Flyer deutschlandweit verteilen"],
});

export default function DistributionRequestPage() {
  return (
    <MarketingPage>
      <section className="mkRequestHero mkRequestHeroSimple">
        <PremiumFlyerField />
        <MarketingContainer>
          <div className="mkRequestHeroCopy">
            <p className="mkEyebrow">Flyerverteilung anfragen</p>
            <h1>Ihre Flyer. Ihr Gebiet. Klar geplant.</h1>
            <p>
              Sie nennen uns Gebiet, Menge und Zeitraum. Wir prüfen die Umsetzung und melden uns mit den nächsten
              Schritten.
            </p>
            <div className="mkRequestHeroActions">
              <a className="mkButton mkButton-primary" href="#anfrage">
                <span>Anfrage starten</span>
              </a>
              <MarketingButton href="/verteilung-planen" variant="ghost">
                Online planen
              </MarketingButton>
            </div>
            <span className="mkRequestHeroNote">Unverbindlich anfragen, persönlich beantwortet.</span>
          </div>
        </MarketingContainer>
      </section>

      <MarketingSection id="anfrage" className="mkInquirySection">
        <div className="mkInquiryLayout">
          <div className="mkInquiryMain">
            <SectionHeader
              eyebrow="Einfach starten"
              title="Anfrage in drei einfachen Schritten."
              intro="Sie müssen keine technische Planung vorbereiten. Schicken Sie uns die wichtigsten Eckdaten, den Rest klären wir gemeinsam."
            />

            <ol className="mkInquirySteps">
              <li>
                <span>1</span>
                <div>
                  <strong>Gebiet nennen</strong>
                  <p>PLZ, Ort oder mehrere Orte, in denen Ihre Flyer ankommen sollen.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Menge und Zeitraum angeben</strong>
                  <p>Wie viele Flyer Sie verteilen möchten und wann die Aktion starten soll.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Rückmeldung erhalten</strong>
                  <p>Wir prüfen die Angaben und melden uns mit einem klaren Vorschlag bei Ihnen.</p>
                </div>
              </li>
            </ol>

            <div className="mkLeadPanel mkInquiryFormPanel">
              <div className="mkInquiryFormIntro">
                <span className="mkInquiryIcon" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <div>
                  <p className="mkEyebrow">Ihre Anfrage</p>
                  <h2>Anfrage senden</h2>
                  <p>Je genauer Ihre Angaben sind, desto schneller können wir Ihnen antworten.</p>
                </div>
              </div>
              <LeadForm source="verteilung-anfragen" inquiry />
            </div>
          </div>

          <aside className="mkInquiryAside" aria-label="Weitere Möglichkeiten">
            <div className="mkInquiryAsideBlock mkInquiryTrustBlock">
              <p className="mkEyebrow">Was Sie erwartet</p>
              <h2>Persönlich geklärt, sauber vorbereitet.</h2>
              <ul>
                <li>Deutschlandweite Gebiete möglich</li>
                <li>Eigene, bereits gedruckte Flyer an unser Lager senden</li>
                <li>Nach der Verteilung verfügbare Nachweise im Kundenkonto</li>
              </ul>
            </div>

            <div className="mkInquiryAsideBlock mkInquiryAlternative">
              <p className="mkEyebrow">Alternativ</p>
              <h2>Lieber schriftlich?</h2>
              <p>{getPublicPrintMessage()}</p>
              <a className="mkInquiryPdfLink" href="/downloads/flyero-anfrageformular.pdf" download>
                Anfrageformular herunterladen
              </a>
              <div className="mkInquiryEmail">
                <Mail aria-hidden="true" />
                <span>
                  <small>E-Mail-Adresse</small>
                  <strong>hallo@flyero.org</strong>
                </span>
              </div>
            </div>

            <div className="mkInquiryAsideBlock mkInquiryOnlineBlock">
              <p className="mkEyebrow">Sofort loslegen</p>
              <h2>Gebiet selbst planen</h2>
              <p>Wenn Sie Gebiet und Preis direkt prüfen möchten, können Sie online starten.</p>
              <MarketingButton href="/verteilung-planen" variant="dark">
                Online planen
              </MarketingButton>
            </div>
          </aside>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
