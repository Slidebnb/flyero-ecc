import {
  AudienceCard,
  CTAChoiceCard,
  FAQItem,
  FeatureCard,
  HeroVisual,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofMockup,
  SectionHeader,
  StepCard,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung mit GPS-Nachweis und Kundenbericht",
  description:
    "FLYERO plant Flyerverteilung digital: Gebiet anfragen oder online buchen, Tour per GPS dokumentieren und geprüften Kundenbericht erhalten.",
  path: "/",
  keywords: ["Flyerverteilung GPS Nachweis", "Flyer verteilen mit Bericht", "Flyer Zustellnachweis"],
});

const directBookingParam = encodeURIComponent("/customer/orders/new");

const problems = [
  ["Keine Kontrolle", "Nach der Abgabe bleibt oft unklar, ob wirklich im richtigen Gebiet verteilt wurde.", defaultProofIcons.shield],
  ["Keine Nachweise", "Fotos, Zeiten und Tourverlauf liegen selten sauber zusammen.", defaultProofIcons.camera],
  ["Unklare Zustellung", "Kunden sehen am Ende nur eine Aussage, aber keinen belastbaren Ablauf.", defaultProofIcons.report],
  ["Zu viel Abstimmung", "Gebiet, Lager, Verteiler und Bericht laufen oft über einzelne Nachrichten.", defaultProofIcons.bag],
] as const;

const solutions = [
  ["Gebietsauswahl", "PLZ, Ort oder Wunschgebiet sauber planen und im Auftrag speichern.", defaultProofIcons.gps],
  ["Online-Zahlung", "Preis und Auftrag vor der Buchung transparent prüfen.", defaultProofIcons.report],
  ["Lager & QR", "Flyer einchecken, Ware zuordnen und Abholung nachvollziehbar machen.", defaultProofIcons.bag],
  ["GPS-Tour", "Verteiler starten die Tour mit Standortfreigabe und laufender Spur.", defaultProofIcons.gps],
  ["Foto-Nachweise", "Bilder ergänzen Strecke, Zeit und Status der Verteilung.", defaultProofIcons.camera],
  ["PDF-Bericht", "Kunden erhalten einen geprüften Bericht mit Rechnung im Portal.", defaultProofIcons.report],
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
  ["Gebiet wählen", "Ort, PLZ oder Wunschgebiet festlegen."],
  ["Flyer hochladen", "Druckdaten oder Druckoption übergeben."],
  ["Online bezahlen", "Preis prüfen und Auftrag buchen."],
  ["GPS-Verteilung", "Tour starten, laufen und dokumentieren."],
  ["Bericht erhalten", "PDF, Fotos und Rechnung im Portal sehen."],
] as const;

const advantages = [
  ["Ein Ablauf", "Auftrag, Zahlung, Lager, Dispatch und Bericht laufen im gleichen System."],
  ["Prüfbare Arbeit", "GPS-Spur, Fotos und Zeiten machen die Verteilung nachvollziehbar."],
  ["Weniger Rückfragen", "Kunden sehen Status, Rechnung und Bericht zentral im Portal."],
  ["Skalierbar", "Startregion Koblenz, vorbereitet für weitere Gebiete und Lager."],
] as const;

const faqs = [
  ["Muss ich mich registrieren, um anzufragen?", "Nein. Eine unverbindliche Anfrage ist öffentlich möglich. Für eine direkte Buchung und den späteren Bericht wird ein Kundenkonto benötigt."],
  ["Wie entsteht der Nachweis?", "Verteiler starten die Tour mobil, GPS-Punkte und Fotos werden gespeichert und danach durch das Admin-Team geprüft."],
  ["Kann ich Druck und Verteilung zusammen buchen?", "Ja. Druckdaten, Lagerung und Verteilung können im Ablauf zusammen geplant werden. Bei individuellen Druckanforderungen klären wir die Details vor der Buchung."],
  ["Wie schnell kann eine Verteilung starten?", "Das hängt von Gebiet, Auflage, Druckdaten und Verfügbarkeit der Verteiler ab. Für einfache Kampagnen kann die Planung kurzfristig starten, sobald Daten und Gebiet klar sind."],
  ["Bekomme ich Fotos und GPS-Nachweis nach der Verteilung?", "Ja. Der Nachweis besteht aus GPS-Tourdaten, Foto-Dokumentation und einem geprüften Bericht, sobald die Tour abgeschlossen und freigegeben wurde."],
  ["Kann ich den Preis vorher sehen?", "Ja. Bei der direkten Online-Buchung werden Gebiet, Menge und Zeitraum vor der Zahlung geprüft."],
  ["Ist FLYERO nur für Koblenz gedacht?", "Die Startregion ist Koblenz und Umgebung. Die Plattform ist aber für weitere Regionen, Lager und Teams vorbereitet."],
] as const;

export default function HomePage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="home-hero-title">
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Flyerverteilung mit Nachweis</p>
            <h1 id="home-hero-title">Flyer verteilen. Beweise liefern.</h1>
            <p className="mkHeroLead">
              Flyer verteilen kann jeder. Nachweisen nicht.{" "}
              FLYERO verbindet Gebietsauswahl, Zahlung, Lager, GPS-Tour, Foto-Nachweise und Kundenbericht
              in einem professionellen Ablauf für lokale Kampagnen.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-anfragen">Verteilung anfragen</MarketingButton>
              <MarketingButton href={`/login?next=${directBookingParam}`} variant="ghost">Online Buchung ansehen</MarketingButton>
            </div>
            <div className="mkTrustRow" aria-label="FLYERO Nachweise">
              <TrustBadge icon={defaultProofIcons.gps}>GPS-verifiziert</TrustBadge>
              <TrustBadge icon={defaultProofIcons.camera}>Foto-Nachweise</TrustBadge>
              <TrustBadge icon={defaultProofIcons.report}>PDF-Bericht</TrustBadge>
            </div>
          </div>
          <HeroVisual />
        </MarketingContainer>
      </section>

      <MarketingSection
        eyebrow="Problem"
        title="Flyer verteilt - aber wirklich?"
        intro="Ohne saubere Nachweise bleibt Flyerverteilung schwer prüfbar. FLYERO macht die operative Arbeit sichtbar."
      >
        <div className="mkGrid mkGrid-4">
          {problems.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Lösung"
        title="FLYERO macht Verteilung nachvollziehbar."
        intro="Jeder Schritt bekommt einen Status, einen Ort im Prozess und am Ende einen prüfbaren Bericht."
        tone="green"
      >
        <div className="mkGrid">
          {solutions.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        id="zielgruppen"
        eyebrow="Zielgruppen"
        title="Für jede Branche der passende Verteilerweg."
        intro="Kurze Wege, klare Gebiete und ein Bericht, der auch nach der Kampagne noch belastbar bleibt."
      >
        <div className="mkGrid">
          {audiences.map(([title, text, signal]) => (
            <AudienceCard key={title} title={title} text={text} signal={signal} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Ablauf"
        title="In fünf Schritten zur dokumentierten Verteilung."
        intro="Einfach genug für Kunden. Strukturiert genug für Lager, Verteiler und Admin-Prüfung."
      >
        <ol className="mkSteps">
          {steps.map(([title, text], index) => (
            <StepCard key={title} title={title} text={text} index={index} />
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection tone="dark" className="mkProofSection">
        <div className="mkProofLayout">
          <div className="mkProofText">
            <p className="mkEyebrow">Nachweis</p>
            <h2>GPS-Spur, Fotos und Bericht statt Bauchgefühl.</h2>
            <p>
              Der Kunde sieht nicht nur, dass verteilt wurde. Er sieht Tourdaten, Fotobelege,
              Statusschritte und den freigegebenen PDF-Bericht im Portal.
            </p>
            <div className="mkProofMetrics">
              <span><strong>GPS</strong>Tourspur</span>
              <span><strong>Foto</strong>Nachweis</span>
              <span><strong>PDF</strong>Bericht</span>
            </div>
          </div>
          <ProofMockup area="Koblenz Süd" />
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Vorteile"
        title="Eine Plattform für den ganzen Kernprozess."
        intro="FLYERO bleibt bewusst auf den Ablauf fokussiert, der für Kunden wirklich zählt: Auftrag, Verteilung, Nachweis."
      >
        <div className="mkAdvantageRail">
          {advantages.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection
        eyebrow="Starten"
        title="Beratung oder direkte Buchung."
        intro="Unverbindlich anfragen bleibt öffentlich. Die direkte Buchung läuft geschützt über das Kundenkonto."
      >
        <div className="mkChoiceGrid">
          <CTAChoiceCard
            title="Unverbindlich anfragen"
            text="Für Kampagnen, bei denen Gebiet, Auflage oder Timing noch geklärt werden sollen."
            bullets={["Persönliche Beratung", "Individuelles Angebot", "Keine Registrierung nötig"]}
            href="/verteilung-anfragen"
            buttonLabel="Anfrage starten"
            icon={defaultProofIcons.shield}
          />
          <CTAChoiceCard
            title="Online Buchung ansehen"
            text="Für konkrete Kampagnen mit Kundenkonto, Gebietsauswahl, Preisprüfung und Auftrag."
            bullets={["Verteilgebiet wählen", "Preis vorab sehen", "Nachweis im Portal erhalten"]}
            href={`/login?next=${directBookingParam}`}
            buttonLabel="Buchung starten"
            tone="dark"
            icon={defaultProofIcons.gps}
          />
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
