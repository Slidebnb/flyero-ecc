import Link from "next/link";
import { ArrowRight, Check, MapPinned, PackageCheck, ReceiptText, ShieldCheck } from "lucide-react";
import { occasionPages } from "@/app/anlaesse/occasionData";
import { industryPages } from "@/app/branchen/industryData";
import {
  FAQItem,
  FlyeroLogo,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  PremiumFlyerField,
  TrustBadge,
} from "@/app/components/marketing";

export function FlyerDistributionPillarPage() {
  return (
    <MarketingPage>
      <section className="mkPillarHero" aria-labelledby="pillar-hero-title">
        <PremiumFlyerField />
        <MarketingContainer>
          <div className="mkPillarHeroLayout">
            <div>
              <p className="mkEyebrow">Flyer verteilen lassen</p>
              <h1 id="pillar-hero-title">Flyer verteilen lassen. Klar geplant. Sauber nachgewiesen.</h1>
              <p className="mkPillarHeroLead">
                Gebiet festlegen, eigene gedruckte Flyer anliefern und die Verteilung professionell organisieren lassen. FLYERO verbindet einfache Buchung mit nachvollziehbaren Nachweisen.
              </p>
              <div className="mkHeroActions">
                <MarketingButton href="/verteilung-planen">Gebiet planen</MarketingButton>
                <MarketingButton href="/verteilung-anfragen" variant="ghost">Unverbindlich anfragen</MarketingButton>
              </div>
              <div className="mkTrustRow" aria-label="FLYERO Leistungen">
                <TrustBadge icon={MapPinned}>Gebietsplanung</TrustBadge>
                <TrustBadge icon={PackageCheck}>Eigene Flyer anliefern</TrustBadge>
                <TrustBadge icon={ReceiptText}>Bericht nach Prüfung</TrustBadge>
              </div>
            </div>
            <aside className="mkPillarHeroAside" aria-label="FLYERO Ablauf">
              <FlyeroLogo dark />
              <span className="mkPillarAsideKicker">Der einfache Ablauf</span>
              <ol>
                <li><span>01</span><strong>Gebiet auswählen</strong><small>PLZ, Ort, Karte oder mehrere Teilgebiete.</small></li>
                <li><span>02</span><strong>Flyer anliefern</strong><small>Eigene, bereits gedruckte Flyer zum passenden Lager senden.</small></li>
                <li><span>03</span><strong>Verteilung prüfen</strong><small>Nach der Durchführung werden Nachweise geprüft und veröffentlicht.</small></li>
              </ol>
            </aside>
          </div>
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="So funktioniert es" title="Von der Planung bis zum Kundenbericht.">
        <div className="mkPillarFlow">
          <div className="mkPillarFlowIntro">
            <span className="mkIndustryNumber">01</span>
            <h3>Sie geben den Rahmen vor. FLYERO hält den Ablauf zusammen.</h3>
            <p>Die Onlineplanung bleibt auf das konzentriert, was für einen Auftrag zählt: Gebiet, Flyer, Zeitraum und der nächste klare Schritt.</p>
          </div>
          <ol className="mkPillarFlowList">
            <li><span>01</span><div><strong>Gebiet festlegen</strong><small>Deutschlandweit anfragen, mehrere Teilgebiete möglich.</small></div><MapPinned aria-hidden="true" /></li>
            <li><span>02</span><div><strong>Flyer bereitstellen</strong><small>Eigene, bereits gedruckte Flyer an das zugewiesene Lager senden.</small></div><PackageCheck aria-hidden="true" /></li>
            <li><span>03</span><div><strong>Verteilung beauftragen</strong><small>Direkt online buchen oder zuerst eine Rückmeldung erhalten.</small></div><Check aria-hidden="true" /></li>
            <li><span>04</span><div><strong>Nachweis erhalten</strong><small>GPS-Bericht, Fotos und PDF-Bericht erst nach echter Prüfung.</small></div><ShieldCheck aria-hidden="true" /></li>
          </ol>
        </div>
      </MarketingSection>

      <MarketingSection tone="green" eyebrow="Deutschlandweit" title="Ihr Gebiet entscheidet über den Auftrag.">
        <div className="mkPillarSignal">
          <div>
            <span className="mkIndustryNumber">02</span>
            <h3>Von der einzelnen PLZ bis zu mehreren Städten.</h3>
          </div>
          <p>Sie können Gebiete in ganz Deutschland planen oder zunächst unverbindlich anfragen. Die konkrete Logistik, das passende Lager und die Durchführbarkeit werden je Gebiet geprüft. Es gibt keine feste Begrenzung auf einzelne Städte.</p>
          <Link className="mkTextLink" href="/verteilung-planen">Planung für Ihr Gebiet öffnen <ArrowRight aria-hidden="true" /></Link>
        </div>
      </MarketingSection>

      <MarketingSection tone="dark" eyebrow="Nachweis" title="Flyer verteilen kann jeder. Nachweisen nicht.">
        <div className="mkPillarProof">
          <div>
            <FlyeroLogo dark />
            <h3>Was im Kundenkonto sichtbar wird.</h3>
            <p>FLYERO zeigt nur Unterlagen, die nach der Verteilung tatsächlich vorliegen und intern geprüft wurden. Keine erfundenen Routen, keine vorweggenommenen Ergebnisse.</p>
          </div>
          <ul>
            <li><ReceiptText aria-hidden="true" /><span><strong>GPS-Nachweis</strong><small>des eingesetzten Trackingsystems</small></span></li>
            <li><ReceiptText aria-hidden="true" /><span><strong>Foto-Dokumentation</strong><small>nur freigegebene Aufnahmen</small></span></li>
            <li><ReceiptText aria-hidden="true" /><span><strong>PDF-Verteilbericht</strong><small>nach interner Prüfung</small></span></li>
          </ul>
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Anlässe" title="Für die Kampagne, die Sie gerade planen.">
        <div className="mkPillarLinkColumns">
          <div>
            <p className="mkIndustryNumber">Flyer für</p>
            <ul className="mkPillarLinkList">
              {occasionPages.map((page) => <li key={page.path}><Link href={page.path}>{page.label}<ArrowRight aria-hidden="true" /></Link></li>)}
            </ul>
          </div>
          <div>
            <p className="mkIndustryNumber">Flyerverteilung für</p>
            <ul className="mkPillarLinkList">
              {industryPages.slice(0, 6).map((page) => <li key={page.path}><Link href={page.path}>{page.label}<ArrowRight aria-hidden="true" /></Link></li>)}
            </ul>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Fragen" title="Häufige Fragen zum Flyer verteilen lassen.">
        <div className="mkIndustryFaqList">
          <FAQItem question="Kann ich Flyer direkt online buchen?" answer="Ja. Sie wählen das Gebiet, geben die Menge und den Zeitraum an und können die Buchung online abschließen. Gebietsdaten und Durchführbarkeit werden von FLYERO final geprüft." />
          <FAQItem question="Kann ich zunächst nur unverbindlich anfragen?" answer="Ja. Wenn Gebiet, Termin oder Menge noch abgestimmt werden sollen, senden Sie eine unverbindliche Anfrage ohne direkte Zahlung." />
          <FAQItem question="Druckt FLYERO meine Flyer?" answer="Der Onlineprozess ist auf eigene, bereits gedruckte Flyer ausgelegt. Sie erhalten nach der Buchung die Information, an welches Lager die Flyer gesendet werden sollen. Ein möglicher Druckservice wird separat über FLYERO besprochen." />
          <FAQItem question="Wie sehe ich, was tatsächlich passiert ist?" answer="Nach der Verteilung lädt FLYERO die vorliegenden Nachweise hoch, prüft sie intern und veröffentlicht sie anschließend im Kundenkonto. Dort sehen Sie den freigegebenen GPS-Nachweis, Fotos und den PDF-Bericht." />
        </div>
      </MarketingSection>

      <MarketingSection className="mkIndustryCta" eyebrow="Nächster Schritt" title="Starten Sie mit Ihrem konkreten Gebiet.">
        <div className="mkIndustryCtaInner">
          <p>Wählen Sie Ihr Gebiet oder senden Sie uns die Anfrage. Der nächste Schritt bleibt klar und nachvollziehbar.</p>
          <div className="mkHeroActions">
            <MarketingButton href="/verteilung-planen">Gebiet planen</MarketingButton>
            <MarketingButton href="/verteilung-anfragen" variant="dark">Projekt anfragen</MarketingButton>
          </div>
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
