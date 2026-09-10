import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CakeSlice,
  CalendarDays,
  Check,
  Dumbbell,
  FileText,
  Hammer,
  House,
  Megaphone,
  MapPinned,
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
  if (page.slug === "immobilien") return <ImmobilienLandingPage page={page} />;

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
              <div className="mkIndustryAsideLine"><Check aria-hidden="true" /> Bericht nach Prüfung im Portal</div>
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
            <p><ReceiptText aria-hidden="true" /><span><strong>GPS-Nachweis</strong><small>aus dem eingesetzten GPS-Gerät</small></span></p>
            <p><CameraIcon aria-hidden="true" /><span><strong>Foto-Dokumentation</strong><small>nur freigegebene Aufnahmen</small></span></p>
            <p><ReceiptText aria-hidden="true" /><span><strong>PDF-Verteilbericht</strong><small>nach Prüfung durch FLYERO</small></span></p>
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

function ImmobilienLandingPage({ page }: { page: IndustryPageData }) {
  const campaignTypes = [
    [House, "Einzelobjekt", "Ein Verkaufs- oder Mietobjekt gezielt im passenden Wohngebiet sichtbar machen."],
    [Building2, "Mehrere Immobilien", "Aktuelle Verkaufs- oder Mietangebote auf einem Werbemittel bündeln."],
    [BookOpen, "Immobilienkatalog", "Mehrere Angebote hochwertig als Broschüre oder Katalog regional verteilen."],
    [MapPinned, "Neubauprojekt", "Neue Wohnanlagen, Quartiere oder Eigentumswohnungen zum Verkaufsstart bekannt machen."],
    [Megaphone, "Eigentümerakquise", "Maklerleistungen in den Wohngebieten präsentieren, in denen neue Mandate entstehen."],
    [CalendarDays, "Open House", "Besichtigungen und Termine lokal dort ankündigen, wo Interessenten wohnen."],
  ] as const;
  const workflow = [
    ["01", "Gebiet festlegen", "Wählen Sie PLZ, Ort oder konkrete Teilgebiete rund um Ihre Immobilien."],
    ["02", "Werbemittel planen", "Geben Sie Flyer, Faltflyer, Broschüre oder Katalog und die gewünschte Menge an."],
    ["03", "Preis prüfen", "Sie sehen den Preis direkt passend zu Ihrer Auswahl."],
    ["04", "Auftrag abschließen", "Buchen Sie direkt online und behalten Sie den weiteren Ablauf im Kundenkonto im Blick."],
  ] as const;
  const audiences = [
    [Building2, "Für Immobilienmakler", "Verkaufsobjekte, Mietobjekte, Eigentümerakquise, mehrere Angebote, Kataloge und Open-House-Termine."],
    [House, "Für Bauträger & Projektentwickler", "Neubauprojekte, Eigentumswohnungen, Wohnquartiere, Projektbroschüren und regionale Verkaufsstarts."],
  ] as const;

  return (
    <MarketingPage>
      <section className="mkPropertyHero" aria-labelledby="property-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkPropertyHeroLayout">
          <div className="mkPropertyHeroCopy">
            <h1 id="property-hero-title">Ihre Immobilien. Direkt in die Haushalte Ihrer Wunschregion.</h1>
            <p>Bewerben Sie einzelne Objekte, mehrere Immobilien oder ganze Neubauprojekte gezielt in ausgewählten Wohngebieten – mit Flyern, Faltflyern, Broschüren oder Immobilienkatalogen.</p>
            <div className="mkHeroActions">
              <MarketingButton href="/verteilung-planen">Verteilgebiet & Preis prüfen</MarketingButton>
              <Link className="mkPropertySecondaryLink" href="/so-funktionierts">Ablauf ansehen <ArrowRight aria-hidden="true" /></Link>
            </div>
            <div className="mkPropertyTrust" aria-label="Was Sie mit FLYERO erhalten">
              <TrustBadge icon={MapPinned}>Digitale Planung</TrustBadge>
              <TrustBadge icon={ReceiptText}>Transparente Preisübersicht</TrustBadge>
              <TrustBadge icon={BadgeCheck}>Nachweise im Kundenkonto</TrustBadge>
            </div>
          </div>
          <aside className="mkPropertyHeroPanel" aria-label="Immobilienkampagne planen">
            <span className="mkPropertyPanelLabel">Ihre Immobilienkampagne</span>
            <strong>Ein Gebiet. Mehrere Möglichkeiten.</strong>
            <p>Planen Sie die regionale Reichweite passend zu Ihrem Objekt, Projekt oder Katalog.</p>
            <div className="mkPropertyPanelList">
              <span><House aria-hidden="true" /> Verkaufs- und Mietobjekte</span>
              <span><Building2 aria-hidden="true" /> Neubau und Projektentwicklung</span>
              <span><FileText aria-hidden="true" /> Broschüren und Immobilienkataloge</span>
            </div>
          </aside>
        </MarketingContainer>
      </section>

      <MarketingSection title="Online sichtbar. Regional präsent." intro="Ihre Immobilien sind bereits online. FLYERO bringt sie zusätzlich direkt zu den Menschen in Ihrer Zielregion.">
        <div className="mkPropertyProblem">
          <div><span className="mkPropertyNumber">01</span><strong>Immobilienwerbung beginnt mit dem richtigen Umfeld.</strong></div>
          <p>Online-Reichweite ist wichtig. Aber nicht jeder potenzielle Käufer, Mieter oder Eigentümer sucht gerade auf einem Immobilienportal oder folgt Ihnen in sozialen Medien. Mit FLYERO bringen Sie Ihre Immobilienwerbung zusätzlich direkt in ausgewählte Haushalte Ihrer Zielregion.</p>
        </div>
      </MarketingSection>

      <MarketingSection tone="green" title="Nicht nur ein Objekt bewerben." intro="Bündeln Sie mehrere aktuelle Verkaufs- oder Mietangebote auf einem Faltflyer, einer Broschüre oder einem Immobilienkatalog und lassen Sie diese gezielt in ausgewählten Gebieten verteilen.">
        <div className="mkPropertyCampaignGrid">
          {campaignTypes.map(([Icon, title, text]) => <article key={title}><span className="mkPropertyIcon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </MarketingSection>

      <MarketingSection title="Für Makler und Projektentwickler." intro="Ob Maklerbüro oder Projektentwicklung – planen Sie Ihre regionale Verteilung einfach online.">
        <div className="mkPropertyAudienceGrid">
          {audiences.map(([Icon, title, text]) => <article key={title}><span className="mkPropertyIcon"><Icon aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
        <div className="mkPropertyInlineCta"><span>Bereit für Ihre Wunschregion?</span><MarketingButton href="/verteilung-planen">Verteilgebiet & Preis prüfen</MarketingButton></div>
      </MarketingSection>

      <MarketingSection tone="green" title="Von der Immobilie zum passenden Verteilgebiet." intro="Planen Sie Gebiet, Werbemittel, Menge und Auftrag vollständig online.">
        <ol className="mkPropertyWorkflow">{workflow.map(([number, title, text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      </MarketingSection>

      <MarketingSection tone="dark" title="Ihre Verteilung. Jederzeit im Blick." intro="Von der Planung bis zum Verteilnachweis behalten Sie Ihre Kampagne im Kundenkonto übersichtlich im Blick.">
        <div className="mkPropertyProofGrid">
          <p>Planen, buchen und verwalten Sie Ihre Verteilung online und behalten Sie Status und Nachweise bequem im Kundenkonto im Blick.</p>
          <ul><li><Check aria-hidden="true" /> Gebiet und Auftrag klar dokumentiert</li><li><Check aria-hidden="true" /> Status und Unterlagen im Kundenkonto</li><li><Check aria-hidden="true" /> GPS-, Foto- und PDF-Nachweise nach Prüfung</li></ul>
        </div>
      </MarketingSection>

      <MarketingSection title="Noch keine gedruckten Werbemittel?" intro="Ihre Druckvorlage ist bereits fertig? Auf Anfrage organisieren wir den Druck gerne für Sie. Die Druckkosten werden individuell kalkuliert.">
        <div className="mkPropertyPrintCta"><span>Vorlage fertig, Druck noch offen?</span><MarketingButton href="/kontakt" variant="dark">Druckservice anfragen</MarketingButton></div>
      </MarketingSection>

      <MarketingSection eyebrow="Fragen" title="Häufige Fragen zur Flyerverteilung für Immobilien.">
        <div className="mkIndustryFaqList">{page.faq.map((item) => <FAQItem key={item.question} question={item.question} answer={item.answer} />)}</div>
      </MarketingSection>

      <MarketingSection className="mkIndustryCta" title="Bringen Sie Ihre Immobilien in die richtige Region.">
        <div className="mkPropertyFinalCta"><p>Prüfen Sie jetzt online, welches Verteilgebiet und welcher Preis zu Ihrer Immobilienkampagne passen.</p><MarketingButton href="/verteilung-planen">Verteilgebiet & Preis prüfen</MarketingButton></div>
      </MarketingSection>
    </MarketingPage>
  );
}
