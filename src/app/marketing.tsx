import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const regions = ["Koblenz", "Neuwied", "Bendorf", "Lahnstein", "Vallendar", "Andernach", "Mülheim-Kärlich"];

export const featureCards = [
  ["Gebiet wählen", "PLZ, Ort oder Wunschgebiet auf der Karte festlegen."],
  ["Flyer hochladen", "Druckdaten, Menge und Format strukturiert übergeben."],
  ["Prüfen & buchen", "Preis, Zeitraum und Lagerweg vor der Zahlung sehen."],
  ["Verteilen lassen", "Verteiler, Lager und Nachweis laufen im Portal zusammen."],
];

export function FlyeroLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`flyeroLogo${dark ? " dark" : ""}`} aria-label="FLYERO">
      <span className="flyeroMark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>FLYERO</strong>
    </span>
  );
}

export function PublicNav() {
  return (
    <header className="marketingNav">
      <Link href="/" className="brandMark" aria-label="FLYERO Startseite">
        <FlyeroLogo />
      </Link>
      <nav>
        <Link href="/fuer-unternehmen">Leistungen</Link>
        <Link href="/so-funktionierts">Verteilgebiete</Link>
        <Link href="/fuer-unternehmen#zielgruppen">Zielgruppen</Link>
        <Link href="/so-funktionierts">So funktioniert&apos;s</Link>
        <Link href="/preise">Preise</Link>
        <Link href="/kontakt">Wissen</Link>
        <Link className="navLogin" href="/login">Login</Link>
        <Link className="navCta" href="/verteilung-anfragen">Unverbindlich anfragen</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="marketingFooter">
      <div>
        <FlyeroLogo />
        <p>Flyerverteilung mit Gebietsauswahl, Lagerprozess und nachvollziehbarem Bericht.</p>
      </div>
      <nav>
        <Link href="/kontakt">Kontakt</Link>
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/agb">AGB</Link>
      </nav>
    </footer>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <main className="marketingShell flyeroPublic">
      <PublicNav />
      {children}
      <PublicFooter />
    </main>
  );
}

export function HeroVisual() {
  return (
    <div className="flyeroHeroVisual" aria-label="FLYERO Flyer und Kartenmotiv">
      <div className="heroMapLines" aria-hidden="true" />
      <Image
        src="/generated/marketing/flyero-hero-proof.png"
        alt="Flyer, Kartenroute und FLYERO Plattformmotiv"
        width={1600}
        height={1000}
        className="heroAsset"
        priority
      />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  children,
  primaryHref = "/verteilung-anfragen",
  primaryLabel = "Unverbindlich anfragen",
  secondaryHref = "/login",
  secondaryLabel = "Login",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="marketingHero">
      <div className="heroCopy">
        <p className="heroProof">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="heroLead">{children}</div>
        <div className="heroBenefits">
          <div>
            <span className="benefitIcon">◎</span>
            <p>Über 2.500 aktive Verteiler</p>
          </div>
          <div>
            <span className="benefitIcon">⌂</span>
            <p>Seit 2011 für lokale Unternehmen</p>
          </div>
        </div>
        <div className="actions">
          <Link href={primaryHref}>{primaryLabel}<span aria-hidden="true">→</span></Link>
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}

export function ProblemVisual() {
  return (
    <div className="problemVisual" aria-label="Flyer und Verteilnachweis">
      <Image
        src="/generated/marketing/flyero-problem-proof.png"
        alt="Flyer und Verteilnachweis als FLYERO Motiv"
        width={1600}
        height={1000}
        className="problemAsset"
      />
    </div>
  );
}

export function SignalList({ items }: { items: string[] }) {
  return (
    <ul className="signalList">
      {items.map((item) => (
        <li key={item}>
          <span aria-hidden="true">✓</span>
          <strong>{item}</strong>
        </li>
      ))}
    </ul>
  );
}

export function SolutionPath({ items }: { items: string[] }) {
  return (
    <div className="solutionPath flyeroProcessLine">
      {items.map((item, index) => (
        <article key={item}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item}</strong>
        </article>
      ))}
    </div>
  );
}

export function FeatureShowcase({ items }: { items: string[][] }) {
  return (
    <div className="featureShowcase flyeroFeatureSteps">
      {items.map(([title, text], index) => (
        <article key={title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function AudienceList({ items }: { items: string[][] }) {
  return (
    <div className="audienceList flyeroAudienceGrid">
      {items.map(([title, text, signal]) => (
        <article key={title}>
          <span className="audienceIcon" aria-hidden="true" />
          <strong>{title}</strong>
          <p>{text}</p>
          {signal ? <em>{signal}</em> : null}
        </article>
      ))}
    </div>
  );
}

export function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section className="marketingSection">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function CardGrid({ items }: { items: string[] | string[][] }) {
  return (
    <div className="marketingCards">
      {items.map((item) => {
        const title = Array.isArray(item) ? item[0] : item;
        const text = Array.isArray(item) ? item[1] : "";
        return (
          <article className="marketingCard" key={title}>
            <strong>{title}</strong>
            {text ? <p>{text}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

export function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="stepList flyeroTimeline">
      {steps.map((step, index) => (
        <li key={step}>
          <span>{String(index + 1)}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

export function CtaBand() {
  return (
    <section className="ctaBand flyeroTrustBand">
      <div>
        <p className="eyebrow">Deutschlandweite Abdeckung</p>
        <h2>Von Hamburg bis München lokal stark, bundesweit vernetzt.</h2>
      </div>
      <div className="actions">
        <Link href="/verteilung-anfragen">Neue Kampagne erstellen<span aria-hidden="true">→</span></Link>
        <Link href="/login">Portal öffnen</Link>
      </div>
    </section>
  );
}
