import Link from "next/link";
import { ArrowRight, Check, MapPinned, ReceiptText, ShieldCheck } from "lucide-react";
import {
  FAQItem,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import type { SeoIntentPageData } from "@/app/seoIntentData";

export function SeoIntentPage({ page }: { page: SeoIntentPageData }) {
  return (
    <MarketingPage>
      <section className="mkPillarHero" aria-labelledby="seo-intent-title">
        <PremiumFlyerField />
        <MarketingContainer>
          <div className="mkPillarHeroLayout">
            <div>
              <p className="mkEyebrow">{page.eyebrow}</p>
              <h1 id="seo-intent-title">{page.title}</h1>
              <p className="mkPillarHeroLead">{page.lead}</p>
              <div className="mkHeroActions">
                <MarketingButton href="/verteilung-planen">Gebiet und Preis prüfen</MarketingButton>
                <MarketingButton href="/verteilung-anfragen" variant="ghost">Unverbindlich anfragen</MarketingButton>
              </div>
              <div className="mkTrustRow" aria-label="FLYERO Nachweise">
                <TrustBadge icon={defaultProofIcons.gps}>GPS-Nachweis</TrustBadge>
                <TrustBadge icon={defaultProofIcons.camera}>Foto-Dokumentation</TrustBadge>
                <TrustBadge icon={defaultProofIcons.report}>PDF-Bericht</TrustBadge>
              </div>
            </div>
            <aside className="mkPillarHeroAside" aria-label={page.label}>
              <span className="mkPillarAsideKicker">{page.label}</span>
              <h2>{page.asideTitle}</h2>
              <ol>
                {page.asidePoints.map((point, index) => (
                  <li key={point}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{point}</strong>
                      <small>klar im Auftrag nachvollziehbar</small>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </MarketingContainer>
      </section>

      {page.sections.map((section, index) => (
        <MarketingSection
          key={section.title}
          tone={index === 1 ? "green" : "light"}
          eyebrow={section.eyebrow}
          title={section.title}
          intro={section.text}
        >
          <div className="mkSeoIntentList">
            {section.points.map((point, pointIndex) => (
              <article key={point}>
                <span>{String(pointIndex + 1).padStart(2, "0")}</span>
                <strong>{point}</strong>
                <Check aria-hidden="true" />
              </article>
            ))}
          </div>
        </MarketingSection>
      ))}

      <MarketingSection tone="dark" eyebrow="Nachweise" title="Nach der Verteilung zählt, was freigegeben wurde.">
        <div className="mkPillarProof">
          <div>
            <h3>Planung sichtbar, Abschluss nachvollziehbar.</h3>
            <p>
              FLYERO zeigt keine angeblichen Ergebnisse vor der Durchführung. Im Kundenkonto erscheinen nur freigegebene
              Unterlagen zur jeweiligen Kampagne.
            </p>
          </div>
          <ul>
            <li><MapPinned aria-hidden="true" /><span><strong>Gebiet</strong><small>aus der gespeicherten Kampagne</small></span></li>
            <li><ShieldCheck aria-hidden="true" /><span><strong>Nachweise</strong><small>nach Prüfung freigegeben</small></span></li>
            <li><ReceiptText aria-hidden="true" /><span><strong>Bericht</strong><small>als PDF im Kundenkonto</small></span></li>
          </ul>
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Fragen" title={`Häufige Fragen zu ${page.label}.`}>
        <div className="mkIndustryFaqList">
          {page.faq.map((item) => <FAQItem key={item.question} question={item.question} answer={item.answer} />)}
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Weiterlesen" title="Passende nächste Schritte.">
        <div className="mkLandingLinkList">
          {page.relatedLinks.map(([label, href]) => (
            <Link key={href} href={href}>
              <span>{label}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="mkIndustryCta" eyebrow="Start" title="Planen Sie Ihre Verteilung mit dem konkreten Gebiet.">
        <div className="mkIndustryCtaInner">
          <p>Starten Sie mit PLZ, Ort oder Adresse und prüfen Sie Gebiet, Menge und Preisvorschau vor dem Absenden.</p>
          <div className="mkHeroActions">
            <MarketingButton href="/verteilung-planen">Planer öffnen</MarketingButton>
            <MarketingButton href="/verteilung-anfragen" variant="dark">Anfrage senden</MarketingButton>
          </div>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}

export function createSeoIntentJsonLd(page: SeoIntentPageData, absoluteUrl: (path: string) => string) {
  const base = {
    "@context": "https://schema.org",
    "@type": page.schemaKind === "service" ? "Service" : "Article",
    name: page.title,
    headline: page.title,
    description: page.description,
    url: absoluteUrl(page.path),
    inLanguage: "de-DE",
  };

  const mainEntity = page.schemaKind === "service"
    ? {
        ...base,
        serviceType: "Flyerverteilung",
        provider: { "@type": "Organization", name: "FLYERO", url: absoluteUrl("/") },
        areaServed: { "@type": "Country", name: "Deutschland" },
      }
    : {
        ...base,
        author: { "@type": "Organization", name: "FLYERO", url: absoluteUrl("/") },
        publisher: { "@type": "Organization", name: "FLYERO", url: absoluteUrl("/") },
      };

  return [
    mainEntity,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FLYERO", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: page.label, item: absoluteUrl(page.path) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];
}
