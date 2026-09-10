import {
  FAQItem,
  HeroVisual,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofStatusPanel,
  PremiumFlyerField,
  SectionHeader,
  TrustBadge,
  audienceIconMap,
  defaultProofIcons,
} from "@/app/components/marketing";
import { BriefcaseBusiness } from "lucide-react";
import { createSeoMetadata } from "@/app/seo";
import { PublicPlannerSearch } from "@/app/PublicPlannerSearch";
import { getPublicPrintMessage } from "@/lib/publicCapabilities";

export const metadata = createSeoMetadata({
  title: "Professionelle Flyerverteilung mit GPS-Nachweis | FLYERO",
  description:
    "Professionelle Flyerverteilung für Unternehmen und Vereine: Gebiet online planen, Verteilung organisieren und GPS-Nachweis, Fotos sowie Abschlussbericht erhalten.",
  path: "/",
  keywords: ["Flyerverteilung GPS Nachweis", "Flyer verteilen mit Bericht", "Flyer Zustellnachweis"],
});

const problems = [
  ["Gebiet nachvollziehbar", "Ihr gewünschtes Gebiet bleibt vom ersten Planungsschritt bis zum Abschluss klar erkennbar.", defaultProofIcons.shield],
  ["Durchführung dokumentiert", "GPS-Daten und Fotos ergänzen die Angaben zur durchgeführten Verteilung.", defaultProofIcons.camera],
  ["Abschlussbericht erhalten", "Sie bekommen die geprüften Unterlagen übersichtlich in Ihrem Kundenkonto.", defaultProofIcons.report],
] as const;

const solutions = [
  ["Gebiet auswählen", "PLZ, Ort oder Wunschgebiet planen und im Auftrag speichern.", defaultProofIcons.gps],
  ["Preis online prüfen", "Sie sehen den Preis vor der Buchung transparent und verständlich.", defaultProofIcons.report],
  ["Flyer einsenden", "Ihre gedruckten Flyer gehen an das passende, zugewiesene Lager.", defaultProofIcons.bag],
  ["Durchführung begleiten", "Die Verteilung wird im vereinbarten Gebiet organisiert.", defaultProofIcons.gps],
  ["Nachweise prüfen", "GPS-Daten und Fotos werden dem Auftrag übersichtlich zugeordnet.", defaultProofIcons.camera],
  ["Bericht erhalten", "Nach der Prüfung finden Sie Bericht und Rechnung in Ihrem Kundenkonto.", defaultProofIcons.report],
] as const;

const audiences = [
  ["Immobilien", "Objekte, Neubauprojekte und Besichtigungstermine im passenden Wohngebiet sichtbar machen.", "Für Makler, Bauträger und Projektentwickler."],
  ["Gastronomie", "Menüs, Eröffnungen und Lieferangebote dort verteilen, wo Bestellungen entstehen.", "Für Restaurants, Cafés und Lieferdienste."],
  ["Fitness", "Probetrainings, Kurse und Studioaktionen rund um relevante Wohngebiete platzieren.", "Für Studios, Vereine und Gesundheitsanbieter."],
  ["Handwerk", "Leistungen, Notdienste, Aktionen und Jobs lokal in passenden Straßenzügen bewerben.", "Für regionale Betriebe und Serviceteams."],
  ["Einzelhandel", "Angebote, Neueröffnungen und Rabattaktionen im echten Einzugsgebiet ankündigen.", "Für Geschäfte, Filialen und lokale Marken."],
  ["Events & Vereine", "Veranstaltungen, Feste und Mitgliederwerbung nachvollziehbar lokal verbreiten.", "Für Veranstalter, Vereine und Kommunen."],
] as const;

const steps = [
  ["Gebiet auswählen", "Ort, PLZ oder gewünschtes Gebiet festlegen."],
  ["Flyer einsenden", "Ihre gedruckten Flyer gehen an das zugewiesene Lager."],
  ["Auftrag bestätigen", "Preis prüfen und Auftrag verbindlich bestätigen."],
  ["Verteilung", "Die Kampagne wird im vereinbarten Gebiet durchgeführt."],
  ["Nachweise erhalten", "GPS, Fotos und Abschlussbericht erscheinen nach Prüfung in Ihrem Kundenkonto."],
] as const;

const advantages = [
  ["Ein Ablauf", "Auftrag, Zahlung, Lager und Bericht gehören übersichtlich zusammen."],
  ["Nachvollziehbare Durchführung", "GPS-Bericht, Fotos und Zeiten dokumentieren die Verteilung."],
  ["Weniger Rückfragen", "Kunden sehen Status, Rechnung und Bericht zentral im Portal."],
  ["Deutschlandweit planbar", "Gebiet und Logistik werden je Auftrag sorgfältig geprüft."],
] as const;

const faqs = [
  ["Muss ich mich registrieren, um anzufragen?", "Nein. Eine unverbindliche Anfrage ist öffentlich möglich. Für eine direkte Buchung und den späteren Bericht wird ein Kundenkonto benötigt."],
  ["Wie entsteht der Nachweis?", "FLYERO nutzt professionelle GPS-Geräte. GPS-Bericht und Fotos werden nach der Durchführung geprüft."],
  ["Kann ich Druck und Verteilung zusammen buchen?", getPublicPrintMessage()],
  ["Wie schnell kann eine Verteilung starten?", "Das hängt von Gebiet, Auflage, Druckdaten und Verfügbarkeit der Verteiler ab. Für einfache Kampagnen kann die Planung kurzfristig starten, sobald Daten und Gebiet klar sind."],
  ["Bekomme ich Fotos und GPS-Nachweis nach der Verteilung?", "Ja. Nach der Prüfung werden GPS-Bericht, Foto-Dokumentation und Abschlussbericht in Ihrem Kundenkonto freigegeben."],
  ["Kann ich den Preis vorher sehen?", "Ja. Bei der direkten Online-Buchung werden Gebiet, Menge und Zeitraum vor der Zahlung geprüft."],
  ["Ist FLYERO nur für eine Region gedacht?", "Nein. Sie können Gebiete in ganz Deutschland planen. Ob eine direkte Durchführung möglich ist, prüfen wir je Gebiet und Logistik."],
] as const;

export default function HomePage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="home-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <h1 id="home-hero-title">Professionelle Flyerverteilung mit GPS-Nachweis.</h1>
            <p className="mkHeroLead">
              Ihre Werbung in den richtigen Briefkästen. Planen Sie Ihr Verteilgebiet online und behalten Sie
              Ihre Kampagne mit GPS-Nachweis, Fotodokumentation und geprüftem Abschlussbericht im Blick.
            </p>
            <PublicPlannerSearch />
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-planen">Gebiet & Preis prüfen</MarketingButton>
              <MarketingButton href="/verteilung-anfragen" variant="ghost">Unverbindlich anfragen</MarketingButton>
            </div>
            <div className="mkTrustRow" aria-label="FLYERO Nachweise">
              <TrustBadge icon={defaultProofIcons.gps}>GPS-Nachweis</TrustBadge>
              <TrustBadge icon={defaultProofIcons.camera}>Foto-Dokumentation</TrustBadge>
              <TrustBadge icon={defaultProofIcons.report}>PDF-Verteilbericht</TrustBadge>
            </div>
          </div>
          <HeroVisual />
        </MarketingContainer>
      </section>

      <MarketingSection
        title="Sie geben tausende Flyer aus der Hand. Was passiert danach?"
        intro="Bei klassischer Flyerverteilung bleibt häufig nur die Aussage: „Ist verteilt.“ FLYERO dokumentiert Gebiet, Durchführung und Abschluss Ihrer Kampagne nachvollziehbar."
      >
        <div className="mkEditorialList">
          {problems.map(([title, text, Icon], index) => (
            <article className="mkEditorialRow" key={title}>
              <span className="mkEditorialIndex">0{index + 1}</span>
              <span className="mkEditorialIcon" aria-hidden="true"><Icon /></span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="Ihre Kampagne bleibt klar begleitet."
        intro="Von der Gebietsplanung bis zum geprüften Abschlussbericht sehen Sie, was als Nächstes passiert."
        tone="green"
      >
        <div className="mkEditorialList mkSolutionList">
          {solutions.map(([title, text, Icon], index) => (
            <article className="mkEditorialRow" key={title}>
              <span className="mkEditorialIndex">0{index + 1}</span>
              <span className="mkEditorialIcon" aria-hidden="true"><Icon /></span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        id="zielgruppen"
        title="Flyerverteilung für lokale Unternehmen."
        intro="Ob Neueröffnung, Angebot, Immobilie oder Veranstaltung: Sie wählen das Gebiet – FLYERO organisiert die Verteilung und Dokumentation."
      >
        <div className="mkAudienceList">
          {audiences.map(([title, text, signal], index) => {
            const Icon = audienceIconMap[title] ?? BriefcaseBusiness;
            return (
              <article className="mkAudienceRow" key={title}>
                <span className="mkEditorialIndex">0{index + 1}</span>
                <span className="mkEditorialIcon" aria-hidden="true"><Icon /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <small>{signal}</small>
              </article>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection
        title="So einfach funktioniert’s."
        intro="In wenigen Schritten zu mehr Sichtbarkeit in Ihrer Region."
      >
        <ol className="mkProcessList">
          {steps.map(([title, text], index) => {
            const icons = [defaultProofIcons.gps, defaultProofIcons.report, defaultProofIcons.report, defaultProofIcons.gps, defaultProofIcons.shield];
            const Icon = icons[index];
            return (
              <li className="mkProcessRow" key={title}>
                <span className="mkProcessNumber">0{index + 1}</span>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            );
          })}
        </ol>
      </MarketingSection>

      <MarketingSection tone="dark" className="mkProofSection">
        <div className="mkProofLayout">
          <div className="mkProofText">
            <h2>Nach der Verteilung sehen Sie, was gemacht wurde.</h2>
            <p>
              GPS-Daten, Fotodokumentation und Abschlussbericht werden nach der Durchführung geprüft und
              anschließend in Ihrem Kundenkonto freigegeben.
            </p>
            <div className="mkProofMetrics">
              <span><strong>01</strong>GPS-Nachweis</span>
              <span><strong>02</strong>Foto-Dokumentation</span>
              <span><strong>03</strong>PDF-Bericht</span>
            </div>
          </div>
          <ProofStatusPanel />
        </div>
      </MarketingSection>

      <MarketingSection
        title="Alles an einem Ort – vom Auftrag bis zum Verteilbericht."
        intro="FLYERO verbindet die Schritte, die für Sie wirklich zählen: Auftrag, Verteilung und nachvollziehbarer Abschluss."
      >
        <div className="mkAdvantageList">
          {advantages.map(([title, text], index) => (
            <article className="mkAdvantageRow" key={title}>
              <span className="mkEditorialIndex">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        title="Beratung oder direkte Buchung."
        intro="Unverbindlich anfragen bleibt öffentlich. Die direkte Buchung läuft geschützt über das Kundenkonto."
      >
        <div className="mkStartRail">
          <article className="mkStartRow">
            <span className="mkEditorialIndex">01</span>
            <div>
              <h3>Unverbindlich anfragen</h3>
              <p>Für Kampagnen, bei denen Gebiet, Auflage oder Timing noch geklärt werden sollen.</p>
            </div>
            <MarketingButton href="/verteilung-anfragen">Unverbindlich anfragen</MarketingButton>
          </article>
          <article className="mkStartRow">
            <span className="mkEditorialIndex">02</span>
            <div>
              <h3>Online buchen</h3>
              <p>Gebiet wählen, Preis prüfen und den Auftrag geschützt über Ihr Kundenkonto abschließen.</p>
            </div>
            <MarketingButton href="/login?next=%2Fcustomer%2Forders%2Fnew%3Ffresh%3D1" variant="dark">Auftrag buchen</MarketingButton>
          </article>
        </div>
      </MarketingSection>

      <MarketingSection>
        <SectionHeader
          eyebrow="FAQ"
          title="Häufige Fragen."
          intro="Die wichtigsten Antworten, bevor Sie eine Kampagne anfragen oder direkt online buchen."
        />
        <div className="mkFaqList">
          {faqs.map(([question, answer]) => (
            <FAQItem key={question} question={question} answer={answer} />
          ))}
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
