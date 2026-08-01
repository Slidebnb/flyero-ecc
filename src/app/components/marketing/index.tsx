import Link from "next/link";
import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  Dumbbell,
  Hammer,
  Home,
  MapPinned,
  MessageSquareText,
  Navigation,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  UploadCloud,
  Utensils,
} from "lucide-react";
import { MobileMenu } from "@/app/components/MobileMenu";
import { CookieSettingsLink } from "@/app/CookieSettingsLink";
import { industryPages } from "@/app/branchen/industryData";
import { occasionPages } from "@/app/anlaesse/occasionData";
import { seoIntentPages } from "@/app/seoIntentData";
export { IndustryLandingPage } from "@/app/components/marketing/IndustryLandingPage";
export { FlyerDistributionPillarPage } from "@/app/components/marketing/FlyerDistributionPillarPage";

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "coral";

export type CardTone = "light" | "dark" | "green";

export const navItems = [
  ["Leistungen", "/flyerverteilung"],
  ["Ablauf", "/so-funktionierts"],
  ["Zielgruppen", "/fuer-unternehmen#zielgruppen"],
  ["Preise", "/preise"],
  ["Kontakt", "/kontakt"],
] as const;

export const audienceIconMap: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  Immobilien: Home,
  Gastronomie: Utensils,
  Fitness: Dumbbell,
  Handwerk: Hammer,
  Einzelhandel: Store,
  "Events & Vereine": CalendarCheck,
};

export function FlyeroLogo({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`mkLogo${dark ? " isDark" : ""}`} aria-label="FLYERO">
      <span className="mkLogoMark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <strong>FLYERO</strong>
    </span>
  );
}

export function PublicNavbar() {
  return (
    <header className="mkNavbar">
      <Link href="/" aria-label="FLYERO Startseite">
        <FlyeroLogo />
      </Link>
      <nav className="mkDesktopNav" aria-label="Hauptnavigation">
        {navItems.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
        <Link className="mkNavLogin" href="/login">
          Login
        </Link>
        <Link className="mkNavCta" href="/verteilung-anfragen">
          Verteilung anfragen
          <ArrowRight aria-hidden="true" />
        </Link>
      </nav>
      <MobileMenu
        items={navItems.map(([label, href]) => ({ label, href }))}
        cta={{ label: "Verteilung anfragen", href: "/verteilung-anfragen" }}
      />
    </header>
  );
}

export function PublicFooter() {
  const serviceLinks = [
    ["Flyerverteilung", "/flyerverteilung"],
    ["Prospektverteilung", "/prospektverteilung"],
    ["Haushaltswerbung", "/haushaltswerbung"],
    ["GPS-Nachweis", "/flyerverteilung-mit-gps-nachweis"],
    ["Bundesweite Flyerverteilung", "/bundesweite-flyerverteilung"],
    ["Kosten", "/flyerverteilung-kosten"],
  ] as const;
  const knowledgeLinks = [
    [seoIntentPages.find((entry) => entry.path === "/ratgeber")?.label ?? "Ratgeber", "/ratgeber"],
    [seoIntentPages.find((entry) => entry.path === "/ratgeber/flyerverteilung-planen")?.label ?? "Flyerverteilung planen", "/ratgeber/flyerverteilung-planen"],
    [seoIntentPages.find((entry) => entry.path === "/ratgeber/richtige-flyer-auflage")?.label ?? "Richtige Flyerauflage", "/ratgeber/richtige-flyer-auflage"],
    [seoIntentPages.find((entry) => entry.path === "/ratgeber/verteilgebiet-bestimmen")?.label ?? "Verteilgebiet bestimmen", "/ratgeber/verteilgebiet-bestimmen"],
    ["Qualitätssicherung", "/qualitaetssicherung"],
    ["Häufige Fragen", "/haeufige-fragen"],
  ] as const;

  return (
    <footer className="mkFooter">
      <div className="mkFooterBrand">
        <FlyeroLogo />
        <p>Flyerverteilung mit GPS-Nachweis, Foto-Dokumentation und Kundenbericht.</p>
        <span className="mkFooterEmail">hallo@flyero.org</span>
        <p className="mkFooterTrust">
          Für Unternehmen, Vereine und lokale Kampagnen, die nicht nur verteilt, sondern sauber belegt werden sollen.
        </p>
      </div>
      <FooterColumn
        title="Leistungen"
        links={serviceLinks}
      />
      <FooterColumn
        title="Wissen"
        links={knowledgeLinks}
      />
      <FooterColumn
        title="FLYERO"
        links={[
          ["Für Unternehmen", "/fuer-unternehmen"],
          ["Für Verteiler", "/fuer-verteiler"],
          ["So funktioniert's", "/so-funktionierts"],
          ["Preise", "/preise"],
        ]}
      />
      <FooterColumn
        title="Starten"
        links={[
          ["Flyerverteilung", "/flyer-verteilen-lassen"],
          ["Planung starten", "/verteilung-planen"],
          ["Verteilung anfragen", "/verteilung-anfragen"],
          ["Anfrageformular herunterladen", "/downloads/flyero-anfrageformular.pdf"],
          ["Kontakt", "/kontakt"],
          ["Login", "/login"],
        ]}
      />
      <FooterColumn
        title="Branchen"
        links={industryPages.map((page) => [page.label, page.path] as const)}
      />
      <FooterColumn
        title="Anlässe"
        links={occasionPages.map((page) => [page.label, page.path] as const)}
      />
      <FooterColumn
        title="Rechtliches"
        links={[
          ["Impressum", "/impressum"],
          ["Datenschutz", "/datenschutz"],
          ["AGB", "/agb"],
        ]}
      />
      <div className="mkFooterCookieSettings">
        <CookieSettingsLink />
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <nav aria-label={title}>
      <strong>{title}</strong>
      {links.map(([label, href]) => (
        href.endsWith(".pdf") ? (
          <a key={href} href={href} download>
            {label}
          </a>
        ) : (
          <Link key={href} href={href}>
            {label}
          </Link>
        )
      ))}
    </nav>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="mkShell flyeroPublic" tabIndex={-1}>
      <a className="mkSkipLink" href="#main-content">
        Zum Inhalt springen
      </a>
      <PublicNavbar />
      {children}
      <PublicFooter />
    </main>
  );
}

export function PremiumFlyerField() {
  return (
    <div className="mkFlyerField" aria-hidden="true">
      {["GPS", "FOTO", "PDF", "TOUR", "FLYERO", "BERICHT"].map((label, index) => (
        <span key={`${label}-${index}`} className={`mkFlyingFlyer mkFlyingFlyer-${index + 1}`}>
          <i />
          <b>{label}</b>
        </span>
      ))}
    </div>
  );
}

export function MarketingContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mkContainer ${className}`.trim()}>{children}</div>;
}

export function MarketingSection({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "light",
  className = "",
  headingLevel = "h2",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  children: ReactNode;
  tone?: CardTone;
  className?: string;
  headingLevel?: "h1" | "h2";
}) {
  return (
    <section id={id} className={`mkSection mkSection-${tone} ${className}`.trim()}>
      <MarketingContainer>
        {title ? <SectionHeader eyebrow={eyebrow} title={title} intro={intro} headingLevel={headingLevel} /> : null}
        {children}
      </MarketingContainer>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  intro,
  align = "left",
  headingLevel = "h2",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
  headingLevel?: "h1" | "h2";
}) {
  return (
    <div className={`mkSectionHeader mkAlign-${align}`}>
      {eyebrow ? <p>{eyebrow}</p> : null}
      {headingLevel === "h1" ? <h1>{title}</h1> : <h2>{title}</h2>}
      {intro ? <span>{intro}</span> : null}
    </div>
  );
}

export function MarketingButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link className={`mkButton mkButton-${variant} ${className}`.trim()} href={href}>
      <span>{children}</span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export function TrustBadge({ children, icon: Icon = ShieldCheck }: { children: ReactNode; icon?: ComponentType<{ className?: string }> }) {
  return (
    <span className="mkTrustBadge">
      <Icon aria-hidden={true} />
      {children}
    </span>
  );
}

export function HeroVisual() {
  return (
    <div className="mkHeroVisual" aria-label="FLYERO Ablauf bis zum Bericht">
      <div className="mkVisualFrame">
        <div className="mkVisualFrameHeader">
          <div className="mkVisualFrameBrand">
            <FlyeroLogo dark />
            <span>Auftragsübersicht</span>
          </div>
          <span className="mkVisualFrameBadge">klar dokumentiert</span>
        </div>
        <ProcessPreview />
        <div className="mkVisualFrameFooter">
          <span>Ein klarer Ablauf</span>
          <strong>Planen <ArrowRight aria-hidden="true" /> Durchführen <ArrowRight aria-hidden="true" /> Bericht</strong>
        </div>
      </div>
    </div>
  );
}

export function ProcessPreview() {
  const processItems = [
    { number: "01", title: "Gebiet", text: "Auswahl im Auftrag gespeichert.", status: "festgelegt", Icon: MapPinned },
    { number: "02", title: "Flyer", text: "Bereits gedruckte Flyer anliefern.", status: "bereitstellen", Icon: ShoppingBag },
    { number: "03", title: "Durchführung", text: "Verteilung zum vereinbarten Zeitraum.", status: "geplant", Icon: Navigation },
    { number: "04", title: "Nachweise", text: "GPS, Fotos und Angaben werden geprüft.", status: "danach", Icon: Camera },
    { number: "05", title: "Bericht", text: "Freigegebene Unterlagen im Kundenkonto.", status: "danach", Icon: ReceiptText },
  ] as const;

  return (
    <div className="mkProcessPreview" aria-label="FLYERO Nachweisablauf">
      <p className="mkProcessPreviewDisclosure">So bleibt deine Verteilung nachvollziehbar.</p>
      <div className="mkVisualJourney">
        <figure className="mkVisualImageCard">
          <div className="mkVisualImageWrap">
            <Image
              src="/marketing/flyero-doorstep-proof.jpg"
              alt="Illustrative Darstellung von FLYERO Verteilung und Beleg"
              fill
              priority
              sizes="(max-width: 820px) 100vw, 34vw"
            />
          </div>
          <figcaption>Illustrative Darstellung von Verteilung und Beleg</figcaption>
        </figure>
        <div className="mkVisualProcessColumn">
          <p className="mkVisualProcessKicker">Vom Gebiet zum Bericht</p>
          <div className="mkProcessPreviewList">
            {processItems.map(({ number, title, text, status, Icon }) => (
              <div className="mkProcessPreviewRow" key={number}>
                <span className="mkProcessPreviewIcon"><Icon aria-hidden="true" /></span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <em>{status}</em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProofStatusPanel() {
  const proofItems = [
    { label: "GPS-Nachweis", status: "nach der Durchführung", Icon: Navigation },
    { label: "Foto-Dokumentation", status: "nach der Durchführung", Icon: Camera },
    { label: "PDF-Verteilbericht", status: "nach der Prüfung", Icon: ReceiptText },
  ] as const;

  return (
    <div className="mkProofStatusPanel" aria-label="Deine Nachweise bei FLYERO">
      <div className="mkProofStatusHeader">
        <FlyeroLogo dark />
        <span>Deine Nachweise</span>
      </div>
      <div className="mkProofStatusIntro">
        <span className="mkProofStatusKicker">Nachweisstatus</span>
        <strong>Nur echte Unterlagen werden sichtbar.</strong>
        <p>Die Dokumentation entsteht nach der Verteilung und wird vor der Freigabe geprüft.</p>
      </div>
      <div className="mkProofStatusTimeline">
        {proofItems.map(({ label, status, Icon }, index) => (
          <div className="mkProofStatusRow" key={label}>
            <span className="mkProofStatusIndex">0{index + 1}</span>
            <span className="mkProofStatusIcon"><Icon aria-hidden="true" /></span>
            <span className="mkProofStatusCopy">
              <strong>{label}</strong>
              <small>{status}</small>
            </span>
            <span className="mkProofStatusTag">folgt</span>
          </div>
        ))}
      </div>
      <div className="mkProofStatusFooter">
        <Check aria-hidden="true" />
        <span>
          <strong>Keine Vorab-Behauptungen</strong>
          <small>Im Kundenkonto erscheinen nur freigegebene Nachweise.</small>
        </span>
      </div>
    </div>
  );
}

export function FeatureCard({
  title,
  text,
  icon: Icon = BadgeCheck,
  index,
}: {
  title: string;
  text: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  index?: number;
}) {
  return (
    <article className="mkFeatureCard">
      <span className="mkCardIcon" aria-hidden="true">
        <Icon aria-hidden={true} />
      </span>
      {typeof index === "number" ? <small hidden>{String(index + 1).padStart(2, "0")}</small> : null}
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export function AudienceCard({ title, text, signal, ctaLabel }: { title: string; text: string; signal: string; ctaLabel: string }) {
  const Icon = audienceIconMap[title] ?? BriefcaseBusiness;
  return (
    <article className="mkAudienceCard">
      <span className="mkCardIcon" aria-hidden="true">
        <Icon aria-hidden={true} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <small>{signal}</small>
      <Link className="mkTextLink" href="/verteilung-anfragen#anfrage">
        {ctaLabel}
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

export function StepCard({ title, text, index }: { title: string; text: string; index: number }) {
  const icons = [MapPinned, UploadCloud, ReceiptText, Navigation, BadgeCheck];
  const Icon = icons[index] ?? BadgeCheck;
  return (
    <li className="mkStepCard">
      <Icon aria-hidden={true} />
      <h3>{title}</h3>
      <p>{text}</p>
    </li>
  );
}

export function CTAChoiceCard({
  title,
  text,
  bullets,
  href,
  buttonLabel,
  tone = "light",
  icon: Icon = MessageSquareText,
}: {
  title: string;
  text: string;
  bullets: string[];
  href: string;
  buttonLabel: string;
  tone?: CardTone;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <article className={`mkChoiceCard mkChoice-${tone}`}>
      <span className="mkCardIcon" aria-hidden="true">
        <Icon aria-hidden={true} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <ul>
        {bullets.map((bullet) => (
          <li key={bullet}>
            <Check aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>
      <MarketingButton href={href} variant={tone === "dark" ? "coral" : "primary"}>
        {buttonLabel}
      </MarketingButton>
    </article>
  );
}

export function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="mkFaqItem">
      <summary>
        <span>{question}</span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <p>{answer}</p>
    </details>
  );
}

export const defaultProofIcons = {
  gps: Navigation,
  camera: Camera,
  report: ReceiptText,
  shield: ShieldCheck,
  bag: ShoppingBag,
};
