import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const regions = ["Koblenz", "Neuwied", "Bendorf", "Lahnstein", "Vallendar", "Andernach", "Mülheim-Kärlich"];

export const featureCards = [
  ["GPS-Tourstart", "Verteiler starten die Tour erst nach Abholung und Standortfreigabe."],
  ["Live-Spur", "GPS-Punkte, Zeitstempel und Bewegung werden für die Prüfung gespeichert."],
  ["Foto-Nachweis", "Tourfotos ergänzen den Routenverlauf und stärken den Kundennachweis."],
  ["Kundenbericht", "Nach Admin-Prüfung erhält der Kunde Bericht, PDF und Rechnung im Portal."],
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
      <nav aria-label="Hauptnavigation">
        <Link href="/fuer-unternehmen">Leistungen</Link>
        <Link href="/so-funktionierts">Ablauf</Link>
        <Link href="/fuer-unternehmen#zielgruppen">Zielgruppen</Link>
        <Link href="/preise">Preise</Link>
        <Link href="/kontakt">Kontakt</Link>
        <Link className="navLogin" href="/login">Login</Link>
        <Link className="navCta" href="/verteilung-anfragen">Verteilung anfragen</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="marketingFooter">
      <div className="footerBrand">
        <FlyeroLogo />
        <p>Flyerverteilung mit GPS-Tourspur, Foto-Nachweis, Admin-Prüfung und Kundenbericht.</p>
      </div>
      <nav aria-label="FLYERO Seiten">
        <strong>FLYERO</strong>
        <Link href="/fuer-unternehmen">Für Unternehmen</Link>
        <Link href="/fuer-verteiler">Für Verteiler</Link>
        <Link href="/so-funktionierts">So funktioniert&apos;s</Link>
        <Link href="/preise">Preise</Link>
      </nav>
      <nav aria-label="Anfrage und Konto">
        <strong>Starten</strong>
        <Link href="/verteilung-anfragen">Verteilung anfragen</Link>
        <Link href="/kontakt">Kontakt</Link>
        <Link href="/login">Login</Link>
      </nav>
      <nav aria-label="Rechtliches">
        <strong>Rechtliches</strong>
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
    <div className="flyeroHeroVisual" aria-label="FLYERO Flyer, GPS-Spur und Bericht">
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
  primaryLabel = "Verteilung anfragen",
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
            <span className="benefitIcon" aria-hidden="true">✓</span>
            <p>GPS-Spur, Zeitstempel und Fotos statt Bauchgefühl</p>
          </div>
          <div>
            <span className="benefitIcon" aria-hidden="true">✓</span>
            <p>Geprüfter Kundenbericht mit PDF und Rechnung</p>
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
    <div className="featureShowcase flyeroFeatureRows">
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
    <div className="audienceList flyeroAudienceRows">
      {items.map(([title, text, signal], index) => (
        <article key={title}>
          <span className="audienceIndex" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
            {signal ? <em>{signal}</em> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function Section({ eyebrow, title, children, id }: { eyebrow?: string; title: string; children: ReactNode; id?: string }) {
  return (
    <section className="marketingSection" id={id}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function EditorialList({ items }: { items: string[] | string[][] }) {
  return (
    <div className="editorialList marketingFlowList">
      {items.map((item, index) => {
        const title = Array.isArray(item) ? item[0] : item;
        const text = Array.isArray(item) ? item[1] : "";
        return (
          <article className="editorialListItem" key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{title}</strong>
              {text ? <p>{text}</p> : null}
            </div>
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
          <span>{String(index + 1).padStart(2, "0")}</span>
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
        <p className="eyebrow">GPS-Nachweis und Kundenbericht</p>
        <h2>Planen Sie Ihre Verteilung online und behalten Sie den Nachweis im Blick.</h2>
      </div>
      <div className="actions">
        <Link href="/verteilung-anfragen">Verteilung anfragen<span aria-hidden="true">→</span></Link>
        <Link href="/login">Portal öffnen</Link>
      </div>
    </section>
  );
}
