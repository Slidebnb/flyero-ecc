import Link from "next/link";
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

type ButtonVariant = "primary" | "secondary" | "ghost" | "dark" | "coral";

export type CardTone = "light" | "dark" | "green";

export const navItems = [
  ["Leistungen", "/fuer-unternehmen"],
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
  return (
    <footer className="mkFooter">
      <div className="mkFooterBrand">
        <FlyeroLogo />
        <p>Flyerverteilung mit GPS-Nachweis, Foto-Dokumentation und Kundenbericht.</p>
        <a className="mkFooterEmail" href="mailto:hallo@flyero.org">hallo@flyero.org</a>
        <p className="mkFooterTrust">
          Für Unternehmen, Vereine und lokale Kampagnen, die nicht nur verteilt, sondern sauber belegt werden sollen.
        </p>
      </div>
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
          ["Verteilung anfragen", "/verteilung-anfragen"],
          ["Kontakt", "/kontakt"],
          ["Login", "/login"],
        ]}
      />
      <FooterColumn
        title="Rechtliches"
        links={[
          ["Impressum", "/impressum"],
          ["Datenschutz", "/datenschutz"],
          ["AGB", "/agb"],
        ]}
      />
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <nav aria-label={title}>
      <strong>{title}</strong>
      {links.map(([label, href]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <main className="mkShell flyeroPublic">
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
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  intro?: string;
  children: ReactNode;
  tone?: CardTone;
  className?: string;
}) {
  return (
    <section id={id} className={`mkSection mkSection-${tone} ${className}`.trim()}>
      <MarketingContainer>
        {title ? <SectionHeader eyebrow={eyebrow} title={title} intro={intro} /> : null}
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
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`mkSectionHeader mkAlign-${align}`}>
      {eyebrow ? <p>{eyebrow}</p> : null}
      <h2>{title}</h2>
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
    <div className="mkHeroVisual" aria-label="FLYERO Prozess der Nachweiserstellung">
      <ProcessPreview />
    </div>
  );
}

export function ProcessPreview() {
  const processItems = [
    ["01", "Gebiet geplant", "Gebiet und Menge werden vorab festgelegt."],
    ["02", "Verteilung durchgeführt", "Die operative Durchführung wird dokumentiert."],
    ["03", "Nachweise geprüft", "GPS-Bericht, Fotos und Angaben werden intern geprüft."],
    ["04", "Bericht freigegeben", "Erst danach erscheint der Bericht im Kundenkonto."],
  ] as const;

  return (
    <div className="mkProcessPreview" aria-label="Beispielhafter FLYERO Nachweisablauf">
      <div className="mkProofBrand">
        <FlyeroLogo dark />
        <span>Nachweisprozess</span>
      </div>
      <p className="mkProcessPreviewDisclosure">Beispielhafter Ablauf · keine echte Kampagne</p>
      <div className="mkProcessPreviewList">
        {processItems.map(([number, title, text]) => (
          <div className="mkProcessPreviewRow" key={number}>
            <span>{number}</span>
            <div>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProofStatusPanel() {
  const proofItems = [
    ["GPS-Nachweis", "wird nach der Verteilung hochgeladen"],
    ["Foto-Dokumentation", "wird geprüft und freigegeben"],
    ["PDF-Verteilbericht", "wird nach der Prüfung erstellt"],
  ] as const;

  return (
    <div className="mkProofStatusPanel" aria-label="Nachweisablauf bei FLYERO">
      <div className="mkProofStatusHeader">
        <FlyeroLogo dark />
        <span>Nachweisablauf</span>
      </div>
      <div className="mkProofStatusIntro">
        <span className="mkProofStatusKicker">Noch kein Nachweis</span>
        <strong>Die Dokumentation entsteht nach der Verteilung.</strong>
        <p>FLYERO veröffentlicht nur Nachweise, die tatsächlich vorliegen und geprüft wurden.</p>
      </div>
      <div className="mkProofStatusList">
        {proofItems.map(([label, status], index) => (
          <div className="mkProofStatusRow" key={label}>
            <span className="mkProofStatusIndex">0{index + 1}</span>
            <span>
              <strong>{label}</strong>
              <small>{status}</small>
            </span>
          </div>
        ))}
      </div>
      <p className="mkProofStatusNote">Keine Demo-Daten. Keine vorweggenommenen Ergebnisse.</p>
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

export function AudienceCard({ title, text, signal }: { title: string; text: string; signal: string }) {
  const Icon = audienceIconMap[title] ?? BriefcaseBusiness;
  return (
    <article className="mkAudienceCard">
      <span className="mkCardIcon" aria-hidden="true">
        <Icon aria-hidden={true} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <small>{signal}</small>
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
