import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CakeSlice,
  CalendarDays,
  Check,
  Dumbbell,
  Hammer,
  ReceiptText,
  Sparkles,
  Store,
  Utensils,
} from "lucide-react";
import {
  FAQItem,
  FlyeroLogo,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { industryPages, type IndustryPageData } from "@/app/branchen/industryData";
import { occasionPages } from "@/app/anlaesse/occasionData";

const industryIcons = {
  bakery: CakeSlice,
  gastronomy: Utensils,
  fitness: Dumbbell,
  craft: Hammer,
  property: Building2,
  retail: Store,
  events: CalendarDays,
  opening: Sparkles,
} as const;

export function IndustryLandingPage({ page }: { page: IndustryPageData }) {
  const Icon = industryIcons[page.iconKey as keyof typeof industryIcons] ?? Store;
  const CameraIcon = defaultProofIcons.camera;

  return (
    <MarketingPage>
      <section className="mkIndustryHero" aria-labelledby="industry-hero-title">
        <PremiumFlyerField />
        <MarketingContainer>
          <div className="mkIndustryHeroLayout">
            <div className="mkIndustryHeroCopy">
              <p className="mkEyebrow">Flyerverteilung für {page.label}</p>
              <h1 id="industry-hero-title">{page.title}</h1>
              <p className="mkIndustryHeroLead">{page.heroLead}</p>
              <div className="mkHeroActions">
                <MarketingButton href="/verteilung-planen">Gebiet planen</MarketingButton>
                <MarketingButton href="/verteilung-anfragen" variant="ghost">Unverbindlich anfragen</MarketingButton>
              </div>
              <div className="mkTrustRow" aria-label="FLYERO Nachweise">
                <TrustBadge icon={defaultProofIcons.gps}>GPS-Nachweis</TrustBadge>
                <TrustBadge icon={defaultProofIcons.camera}>Foto-Dokumentation</TrustBadge>
                <TrustBadge icon={defaultProofIcons.report}>PDF-Bericht</TrustBadge>
              </div>
            </div>
            <aside className="mkIndustryHeroAside" aria-label={`FLYERO für ${page.label}`}>
              <span className="mkIndustryIcon" aria-hidden="true"><Icon /></span>
              <p className="mkIndustryAsideKicker">Für {page.label}</p>
              <strong>Ihre Aktion bleibt beim Anlass.</strong>
              <p>{page.intro}</p>
              <div className="mkIndustryAsideLine"><Check aria-hidden="true" /> Gebiet passend zum Vorhaben</div>
              <div className="mkIndustryAsideLine"><Check aria-hidden="true" /> Bereits gedruckte Flyer anliefern</div>
              <div className="mkIndustryAsideLine"><Check aria-hidden="true" /> Nachweise nach Prüfung im Portal</div>
            </aside>
          </div>
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Anlässe" title={`Wofür ${page.label} Flyer einsetzen.`} intro={page.intro}>
        <div className="mkIndustryUseCases">
          <div className="mkIndustryLeadStatement">
            <span className="mkIndustryNumber">01</span>
            <strong>Die richtige Botschaft im richtigen Umfeld.</strong>
            <p>Wählen Sie den Anlass, legen Sie das Gebiet fest und passen Sie die Menge an Ihre Kampagne an.</p>
          </div>
          <ul>
            {page.campaignExamples.map((example, index) => (
              <li key={example}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{example}</strong>
                <ArrowRight aria-hidden="true" />
              </li>
            ))}
          </ul>
        </div>
      </MarketingSection>

      <MarketingSection tone="green" eyebrow="Planung" title="Von der Auswahl bis zum Auftrag verständlich geführt.">
        <div className="mkIndustryPlanning">
          <div>
            <span className="mkIndustryNumber">02</span>
            <h3>Gebiet, Menge und Zeitraum gehören zusammen.</h3>
            <p>{page.planningNote}</p>
            <Link className="mkTextLink" href="/verteilung-planen">
              Planung öffnen <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <ol>
            <li><span>01</span><strong>Gebiet festlegen</strong><small>PLZ, Ort, Karte oder mehrere Teilgebiete.</small></li>
            <li><span>02</span><strong>Flyer bestätigen</strong><small>Eigene, bereits gedruckte Flyer angeben.</small></li>
            <li><span>03</span><strong>Preis prüfen</strong><small>Die Berechnung gehört zur konkreten Auswahl.</small></li>
            <li><span>04</span><strong>Online buchen</strong><small>Oder zuerst unverbindlich anfragen.</small></li>
          </ol>
        </div>
      </MarketingSection>

      <MarketingSection tone="dark" eyebrow="Nachweis" title="Verteilen reicht nicht. Der Abschluss muss nachvollziehbar sein.">
        <div className="mkIndustryProof">
          <div>
            <FlyeroLogo dark />
            <h3>Was nach der Verteilung im Kundenkonto ankommt.</h3>
            <p>{page.proofNote}</p>
          </div>
          <div className="mkIndustryProofList">
            <p><ReceiptText aria-hidden="true" /><span><strong>GPS-Nachweis</strong><small>des eingesetzten Trackingsystems</small></span></p>
            <p><CameraIcon aria-hidden="true" /><span><strong>Foto-Dokumentation</strong><small>nur freigegebene Aufnahmen</small></span></p>
            <p><ReceiptText aria-hidden="true" /><span><strong>PDF-Verteilbericht</strong><small>nach interner Prüfung</small></span></p>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Fragen" title={`Häufige Fragen zur Flyerverteilung für ${page.label}.`}>
        <div className="mkIndustryFaqList">
          {page.faq.map((item) => <FAQItem key={item.question} question={item.question} answer={item.answer} />)}
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Mehr entdecken" title="Weitere Wege zu Ihrer Kampagne.">
        <div className="mkLandingLinkList">
          {(page.path.startsWith("/branchen/") ? occasionPages : industryPages).map((relatedPage) => (
            <Link key={relatedPage.path} href={relatedPage.path}>
              <span>{relatedPage.label}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="mkIndustryCta" eyebrow="Nächster Schritt" title="Starten Sie mit Ihrem konkreten Gebiet.">
        <div className="mkIndustryCtaInner">
          <p>Sie kennen den Anlass. FLYERO hilft Ihnen, Gebiet, Flyeranzahl und Ablauf sauber zusammenzubringen.</p>
          <div className="mkHeroActions">
            <MarketingButton href="/verteilung-planen">Gebiet planen</MarketingButton>
            <MarketingButton href="/verteilung-anfragen" variant="dark">Projekt anfragen</MarketingButton>
          </div>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
