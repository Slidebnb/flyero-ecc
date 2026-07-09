import Link from "next/link";
import {
  FlyeroLogo,
  MarketingPage,
  HeroVisual,
} from "@/app/marketing";
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
  ["Keine Kontrolle", "Nach der Abgabe bleibt oft unklar, ob wirklich im richtigen Gebiet verteilt wurde."],
  ["Keine Nachweise", "Fotos, Zeiten und Tourverlauf liegen selten sauber zusammen."],
  ["Unklare Zustellung", "Kunden sehen am Ende nur eine Aussage, aber keinen belastbaren Ablauf."],
  ["Zu viel Abstimmung", "Gebiet, Lager, Verteiler und Bericht laufen oft über einzelne Nachrichten."],
];

const solutions = [
  ["Gebietsauswahl", "PLZ, Ort oder Wunschgebiet sauber planen und im Auftrag speichern."],
  ["Online-Zahlung", "Preis und Auftrag vor der Buchung transparent prüfen."],
  ["Lager & QR", "Flyer einchecken, Ware zuordnen und Abholung nachvollziehbar machen."],
  ["GPS-Tour", "Verteiler starten die Tour mit Standortfreigabe und laufender Spur."],
  ["Foto-Nachweise", "Bilder ergänzen Strecke, Zeit und Status der Verteilung."],
  ["PDF-Bericht", "Kunden erhalten einen geprüften Bericht mit Rechnung im Portal."],
];

const audiences = [
  ["Immobilien", "Objekte, Neubauprojekte und Besichtigungstermine im passenden Wohngebiet sichtbar machen.", "Für Makler, Bauträger und Projektentwickler."],
  ["Gastronomie", "Menüs, Eröffnungen und Lieferangebote dort verteilen, wo Bestellungen entstehen.", "Für Restaurants, Cafés und Lieferdienste."],
  ["Fitness", "Probetrainings, Kurse und Studioaktionen rund um relevante Wohngebiete platzieren.", "Für Studios, Vereine und Gesundheitsanbieter."],
  ["Handwerk", "Leistungen, Notdienste, Aktionen und Jobs lokal in passenden Straßenzügen bewerben.", "Für regionale Betriebe und Serviceteams."],
  ["Einzelhandel", "Angebote, Neueröffnungen und Rabattaktionen im echten Einzugsgebiet ankündigen.", "Für Geschäfte, Filialen und lokale Marken."],
  ["Events & Vereine", "Veranstaltungen, Feste und Mitgliederwerbung nachvollziehbar lokal verbreiten.", "Für Veranstalter, Vereine und Kommunen."],
];

const steps = [
  ["Gebiet wählen", "Ort, PLZ oder Wunschgebiet festlegen."],
  ["Flyer hochladen", "Druckdaten oder Druckoption übergeben."],
  ["Online bezahlen", "Preis prüfen und Auftrag buchen."],
  ["GPS verteilen", "Tour starten, laufen und dokumentieren."],
  ["Bericht erhalten", "PDF, Fotos und Rechnung im Portal sehen."],
];

const advantages = [
  ["Ein Ablauf", "Auftrag, Zahlung, Lager, Dispatch und Bericht laufen im gleichen System."],
  ["Prüfbare Arbeit", "GPS-Spur, Fotos und Zeiten machen die Verteilung nachvollziehbar."],
  ["Weniger Rückfragen", "Kunden sehen Status, Rechnung und Bericht zentral im Portal."],
  ["Skalierbar", "Startregion Koblenz, vorbereitet für weitere Gebiete und Lager."],
];

const faqs = [
  ["Muss ich mich registrieren, um anzufragen?", "Nein. Eine unverbindliche Anfrage ist öffentlich möglich. Für eine direkte Buchung und den späteren Bericht wird ein Kundenkonto benötigt."],
  ["Wie entsteht der Nachweis?", "Verteiler starten die Tour mobil, GPS-Punkte und Fotos werden gespeichert und danach durch das Admin-Team geprüft."],
  ["Kann ich den Preis vorher sehen?", "Ja. Bei der direkten Online-Buchung werden Gebiet, Menge und Zeitraum vor der Zahlung geprüft."],
  ["Ist FLYERO nur für Koblenz gedacht?", "Die Startregion ist Koblenz und Umgebung. Die Plattform ist aber für weitere Regionen, Lager und Teams vorbereitet."],
];

export default function HomePage() {
  return (
    <MarketingPage>
      <section className="premiumHero" aria-labelledby="home-hero-title">
        <div className="premiumHeroCopy">
          <FlyeroLogo dark />
          <p className="premiumEyebrow">Flyerverteilung mit Nachweis.</p>
          <h1 id="home-hero-title">Flyer verteilen. Beweise liefern.</h1>
          <p>
            FLYERO verbindet Gebietsauswahl, Zahlung, Lager, GPS-Tour, Foto-Nachweise und Kundenbericht in einem
            professionellen Ablauf für lokale Kampagnen.
          </p>
          <div className="premiumHeroActions">
            <Link className="premiumButton primary" href="/verteilung-anfragen">Verteilung anfragen<span aria-hidden="true">→</span></Link>
            <Link className="premiumButton ghost" href="/so-funktionierts">Ablauf ansehen</Link>
          </div>
          <div className="trustBadges" aria-label="FLYERO Nachweise">
            <span>GPS-Tourspur</span>
            <span>Foto-Nachweis</span>
            <span>PDF-Bericht</span>
          </div>
        </div>
        <div className="premiumHeroMedia">
          <HeroVisual />
          <div className="floatingProofCard">
            <span>Live</span>
            <strong>GPS-Nachweis aktiv</strong>
            <small>Tour, Fotos und Zeitpunkte werden zusammen geprüft.</small>
          </div>
          <div className="floatingStatusCard">
            <strong>99 %</strong>
            <span>Zustellquote im Bericht</span>
          </div>
        </div>
      </section>

      <section className="premiumSection problemSection" aria-labelledby="problem-title">
        <p className="premiumKicker">Problem</p>
        <div className="sectionHeader">
          <h2 id="problem-title">Flyer verteilt - aber wirklich?</h2>
          <p>Ohne saubere Nachweise bleibt Flyerverteilung schwer prüfbar. FLYERO macht die operative Arbeit sichtbar.</p>
        </div>
        <div className="premiumGrid problemGrid">
          {problems.map(([title, text]) => (
            <article key={title}>
              <span className="premiumIcon" aria-hidden="true">!</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumSection solutionSection" aria-labelledby="solution-title">
        <p className="premiumKicker">Lösung</p>
        <div className="sectionHeader">
          <h2 id="solution-title">FLYERO macht Verteilung nachvollziehbar.</h2>
          <p>Jeder Schritt bekommt einen Status, einen Ort im Prozess und am Ende einen prüfbaren Bericht.</p>
        </div>
        <div className="premiumGrid solutionGrid">
          {solutions.map(([title, text], index) => (
            <article key={title}>
              <span className="premiumIcon" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumSection" id="zielgruppen" aria-labelledby="audience-title">
        <p className="premiumKicker">Zielgruppen</p>
        <div className="sectionHeader">
          <h2 id="audience-title">Für jede Branche der passende Verteilerweg.</h2>
          <p>Kurze Wege, klare Gebiete und ein Bericht, der auch nach der Kampagne noch belastbar bleibt.</p>
        </div>
        <div className="audiencePremiumGrid">
          {audiences.map(([title, text, signal]) => (
            <article key={title}>
              <span className="audienceSymbol" aria-hidden="true">{title.slice(0, 1)}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <small>{signal}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumSection processSection" aria-labelledby="process-title">
        <p className="premiumKicker">Ablauf</p>
        <div className="sectionHeader">
          <h2 id="process-title">In fünf Schritten zur dokumentierten Verteilung.</h2>
          <p>Einfach genug für Kunden. Strukturiert genug für Lager, Verteiler und Admin-Prüfung.</p>
        </div>
        <ol className="processSteps">
          {steps.map(([title, text], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="premiumSection proofSection" aria-labelledby="proof-title">
        <div>
          <p className="premiumKicker">Nachweis</p>
          <h2 id="proof-title">GPS-Spur, Fotos und Bericht statt Bauchgefühl.</h2>
          <p>
            Der Kunde sieht nicht nur, dass verteilt wurde. Er sieht Tourdaten, Fotobelege, Statusschritte und den
            freigegebenen PDF-Bericht im Portal.
          </p>
          <div className="proofMetrics">
            <span><strong>GPS</strong>Tourspur</span>
            <span><strong>Foto</strong>Nachweis</span>
            <span><strong>PDF</strong>Bericht</span>
          </div>
        </div>
        <div className="proofMockup" aria-label="Beispielhafte Berichtsvorschau">
          <div className="proofMap" />
          <div className="proofReport">
            <span>Bericht freigegeben</span>
            <strong>Tour Koblenz Süd</strong>
            <p>GPS-Punkte, Fotos und Zustellquote geprüft.</p>
          </div>
        </div>
      </section>

      <section className="premiumSection advantagesSection" aria-labelledby="advantages-title">
        <p className="premiumKicker">Vorteile</p>
        <div className="sectionHeader">
          <h2 id="advantages-title">Eine Plattform für den ganzen Kernprozess.</h2>
          <p>FLYERO bleibt bewusst auf den Ablauf fokussiert, der für Kunden wirklich zählt: Auftrag, Verteilung, Nachweis.</p>
        </div>
        <div className="advantageRail">
          {advantages.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="premiumSection finalChoiceSection" aria-labelledby="choice-title">
        <p className="premiumKicker">Starten</p>
        <div className="sectionHeader">
          <h2 id="choice-title">Beratung oder direkte Buchung.</h2>
          <p>Unverbindlich anfragen bleibt öffentlich. Die direkte Buchung läuft geschützt über das Kundenkonto.</p>
        </div>
        <div className="choiceCards">
          <article>
            <span className="premiumIcon" aria-hidden="true">?</span>
            <h3>Unverbindlich anfragen</h3>
            <p>Für Kampagnen, bei denen Gebiet, Auflage oder Timing noch geklärt werden sollen.</p>
            <ul>
              <li>Persönliche Beratung</li>
              <li>Individuelles Angebot</li>
              <li>Keine Registrierung nötig</li>
            </ul>
            <Link className="premiumButton primary" href="/verteilung-anfragen">Anfrage starten<span aria-hidden="true">→</span></Link>
          </article>
          <article className="darkChoice">
            <span className="premiumIcon" aria-hidden="true">↗</span>
            <h3>Direkt online buchen</h3>
            <p>Für konkrete Kampagnen mit Kundenkonto, Gebietsauswahl, Preisprüfung und Auftrag.</p>
            <ul>
              <li>Verteilgebiet wählen</li>
              <li>Preis vorab sehen</li>
              <li>Nachweis im Portal erhalten</li>
            </ul>
            <Link className="premiumButton coral" href={`/login?next=${directBookingParam}`}>Direkt buchen<span aria-hidden="true">→</span></Link>
          </article>
        </div>
      </section>

      <section className="premiumSection faqSection" aria-labelledby="faq-title">
        <p className="premiumKicker">FAQ</p>
        <div className="sectionHeader">
          <h2 id="faq-title">Häufige Fragen.</h2>
          <p>Die wichtigsten Antworten, bevor Sie eine Kampagne anfragen oder direkt online buchen.</p>
        </div>
        <div className="faqList">
          {faqs.map(([question, answer]) => (
            <article key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
