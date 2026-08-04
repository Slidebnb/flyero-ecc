import Link from "next/link";
import { ArrowRight, MapPinned, ReceiptText, ShieldCheck } from "lucide-react";
import {
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  TrustBadge,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung im Raum Koblenz, Neuwied und Bendorf | FLYERO",
  description:
    "Regionale Flyerverteilung mit FLYERO: Gebiete im Raum Koblenz, Neuwied und Bendorf planen, mehrere Teilgebiete kombinieren und Nachweise nach Abschluss erhalten.",
  path: "/regionen",
  keywords: [
    "Flyerverteilung Koblenz",
    "Flyerverteilung Neuwied",
    "Flyerverteilung Bendorf",
    "Prospektverteilung Koblenz",
    "Haushaltswerbung Neuwied",
  ],
});

const regionLinks = [
  {
    title: "Flyerverteilung Koblenz",
    href: "/flyerverteilung-koblenz",
    text: "Für lokale Kampagnen in Koblenz, Stadtteilen und angrenzenden Gebieten.",
  },
  {
    title: "Flyerverteilung Neuwied",
    href: "/flyerverteilung-neuwied",
    text: "Für Kampagnen rund um Neuwied, Teilgebiete und kombinierte Nachbarorte.",
  },
  {
    title: "Flyerverteilung Bendorf",
    href: "/flyerverteilung-bendorf",
    text: "Für Bendorf, direkte Umgebung und Kampagnen mit mehreren Teilflächen.",
  },
] as const;

export default function RegionenPage() {
  return (
    <MarketingPage>
      <section className="mkPillarHero" aria-labelledby="regions-title">
        <PremiumFlyerField />
        <MarketingContainer>
          <div className="mkPillarHeroLayout">
            <div>
              <p className="mkEyebrow">Regionale Flyerverteilung</p>
              <h1 id="regions-title">Flyerverteilung im Raum Koblenz, Neuwied und Bendorf.</h1>
              <p className="mkPillarHeroLead">
                Starten Sie mit einem Ort, einer PLZ oder mehreren Teilgebieten. FLYERO führt Gebiet, Stückzahl,
                Empfangslager und Nachweise in einem nachvollziehbaren Auftrag zusammen.
              </p>
              <div className="mkHeroActions">
                <MarketingButton href="/verteilung-planen">Gebiet und Preis prüfen</MarketingButton>
                <MarketingButton href="/verteilung-anfragen" variant="ghost">Unverbindlich anfragen</MarketingButton>
              </div>
              <div className="mkTrustRow" aria-label="FLYERO Nachweise">
                <TrustBadge icon={MapPinned}>Gebietsauswahl</TrustBadge>
                <TrustBadge icon={ShieldCheck}>sauberer Auftrag</TrustBadge>
                <TrustBadge icon={ReceiptText}>Bericht nach Abschluss</TrustBadge>
              </div>
            </div>
            <aside className="mkPillarHeroAside" aria-label="Regionen">
              <span className="mkPillarAsideKicker">Regionen</span>
              <h2>Ein Auftrag kann mehrere Orte verbinden.</h2>
              <ol>
                <li><span>01</span><strong>Ort oder PLZ wählen</strong><small>Mit Koblenz, Neuwied, Bendorf oder weiteren Gebieten starten.</small></li>
                <li><span>02</span><strong>Teilgebiete kombinieren</strong><small>Mehrere Flächen in einer Kampagne planen.</small></li>
                <li><span>03</span><strong>Nachweise erhalten</strong><small>Freigegebene Unterlagen später im Kundenkonto abrufen.</small></li>
              </ol>
            </aside>
          </div>
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Regionen" title="Lokale Seiten für Ihre nächste Kampagne.">
        <div className="mkLandingLinkList">
          {regionLinks.map((region) => (
            <Link key={region.href} href={region.href}>
              <span>
                <strong>{region.title}</strong>
                <small>{region.text}</small>
              </span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tone="green" eyebrow="Deutschlandweit" title="Nicht auf eine Stadt begrenzt.">
        <div className="mkPillarSignal">
          <div>
            <span className="mkIndustryNumber">Mehrgebiete</span>
            <h2>Regional starten, deutschlandweit anfragen.</h2>
          </div>
          <p>
            FLYERO kann Gebiete deutschlandweit anfragen und in einer Kampagne mehrere Orte kombinieren. Die konkrete
            Organisation wird je Auftrag geprüft, damit Gebiet, Lager und Zeitraum zusammenpassen.
          </p>
          <Link className="mkTextLink" href="/bundesweite-flyerverteilung">
            Bundesweite Flyerverteilung ansehen <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
