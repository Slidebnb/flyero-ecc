import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export const regions = ["Koblenz", "Neuwied", "Bendorf", "Lahnstein", "Vallendar", "Andernach", "Mülheim-Kärlich"];

export const featureCards = [
  ["Online-Buchung", "Auftrag, Gebiet und Menge strukturiert erfassen."],
  ["Stripe-Zahlung", "Sichere Vorkasse vor der operativen Prüfung."],
  ["Lager mit QR-Code", "Flyer werden eindeutig eingelagert und abgeholt."],
  ["Geprüfte Verteiler", "Profile werden vor Freischaltung kontrolliert."],
  ["GPS-Tracking", "Touren werden mobil und nachvollziehbar dokumentiert."],
  ["Foto-Nachweise", "Bilder ergänzen den digitalen Verteilnachweis."],
  ["Adminprüfung", "Auftrag und Tour werden vor Freigabe geprüft."],
  ["PDF-Bericht", "Kunden erhalten einen professionellen Abschlussbericht."],
  ["Kundenportal", "Berichte, Rechnungen und Zahlungen an einem Ort."],
];

export function PublicNav() {
  return (
    <header className="marketingNav">
      <Link href="/" className="brandMark" aria-label="FLYERO Startseite">
        <span>FLYERO</span>
      </Link>
      <nav>
        <Link href="/fuer-unternehmen">Für Unternehmen</Link>
        <Link href="/fuer-verteiler">Für Verteiler</Link>
        <Link href="/preise">Preise</Link>
        <Link href="/so-funktionierts">So funktioniert&apos;s</Link>
        <Link href="/kontakt">Kontakt</Link>
        <Link href="/login">Login</Link>
        <Link className="navCta" href="/verteilung-anfragen">
          Verteilung anfragen
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="marketingFooter">
      <div>
        <strong>FLYERO</strong>
        <p>Moderne Flyerverteilung mit GPS-Nachweis. Startregion Koblenz.</p>
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
    <main className="marketingShell">
      <PublicNav />
      {children}
      <PublicFooter />
    </main>
  );
}

export function HeroVisual() {
  return (
    <div className="heroVisual" aria-label="FLYERO Plattformvorschau">
      <Image
        src="/generated/marketing/flyero-hero-proof.png"
        alt="GPS-Karte, QR-Lieferschein, Flyer und Verteilbericht als hochwertige FLYERO Plattformvorschau"
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
  secondaryHref = "/kontakt",
  secondaryLabel = "Kontakt aufnehmen",
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
            <span className="benefitIcon calendarIcon" />
            <p><strong>Online buchen</strong><br />Gebiete wählen, Auflage definieren, Termin festlegen.</p>
          </div>
          <div>
            <span className="benefitIcon cardIcon" />
            <p><strong>Sicher bezahlen</strong><br />Zahlung bequem und sicher über Stripe.</p>
          </div>
          <div>
            <span className="benefitIcon pinIcon" />
            <p><strong>Nachweis erhalten</strong><br />GPS-Tracking und Foto-Report als PDF.</p>
          </div>
        </div>
        <div className="actions">
          <Link href={primaryHref}>{primaryLabel}</Link>
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </div>
        <p className="securityNote">DSGVO-konform. Daten sicher in Deutschland gespeichert.</p>
      </div>
      <HeroVisual />
    </section>
  );
}

export function ProblemVisual() {
  return (
    <div className="problemVisual" aria-label="Ungeprüfte Flyerverteilung ohne Nachweis">
      <Image
        src="/generated/marketing/flyero-problem-proof.png"
        alt="Flyer ohne Nachweis vor einem Briefkasten als Problemmotiv"
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
          <span aria-hidden="true" />
          <strong>{item}</strong>
        </li>
      ))}
    </ul>
  );
}

export function SolutionPath({ items }: { items: string[] }) {
  return (
    <div className="solutionPath">
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
    <div className="featureShowcase">
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
    <div className="audienceList">
      {items.map(([title, text, signal], index) => (
        <article key={title}>
          <span className="audienceIndex">{String(index + 1).padStart(2, "0")}</span>
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
      {items.map((item, index) => {
        const title = Array.isArray(item) ? item[0] : item;
        const text = Array.isArray(item) ? item[1] : "";
        return (
          <article className="marketingCard" key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
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
    <ol className="stepList">
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
    <section className="ctaBand">
      <div>
        <p className="eyebrow">Start in Koblenz & Umgebung</p>
        <h2>Bereit für transparente Flyerverteilung?</h2>
      </div>
      <div className="actions">
        <Link href="/verteilung-anfragen">Verteilung anfragen</Link>
        <Link href="/login">Demo ansehen</Link>
        <Link href="/register/distributor">Verteiler werden</Link>
      </div>
    </section>
  );
}
