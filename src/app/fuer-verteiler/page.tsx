import { LeadForm } from "@/app/LeadForm";
import {
  FeatureCard,
  MarketingButton,
  MarketingContainer,
  MarketingPage,
  MarketingSection,
  ProofMockup,
  PremiumFlyerField,
  StepCard,
  TrustBadge,
  defaultProofIcons,
} from "@/app/components/marketing";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Als Verteiler bei FLYERO starten",
  description:
    "Als Verteiler registrieren, Aufträge annehmen, Flyer per QR-Code abholen und Nachweise strukturiert dokumentieren.",
  path: "/fuer-verteiler",
  keywords: ["Flyer verteilen Job", "Verteiler werden", "Nebenjob Flyer verteilen"],
});

const workItems = [
  ["Touren annehmen", "Freigegebene Verteiler sehen passende Aufträge und nehmen Touren strukturiert an.", defaultProofIcons.bag],
  ["Pickup dokumentieren", "Flyer werden per QR-Code im Lager abgeholt und dem Auftrag zugeordnet.", defaultProofIcons.report],
  ["GPS-Nachweis sichern", "Im MVP wird ein externer GPS-Bericht oder geprüfter Tournachweis dem Auftrag zugeordnet.", defaultProofIcons.gps],
  ["Fotos ergänzen", "Foto-Nachweise werden strukturiert erfasst und vor Kundenfreigabe geprüft.", defaultProofIcons.camera],
] as const;

const steps = [
  ["Profil anlegen", "Daten, Gebiet und Verfügbarkeit eintragen."],
  ["Prüfung abwarten", "Das Admin-Team schaltet passende Verteiler frei."],
  ["Auftrag annehmen", "Tourdetails prüfen und verbindlich übernehmen."],
  ["Nachweise liefern", "Externen GPS-Bericht, Fotos und Ist-Werte vollständig übergeben."],
  ["Abschluss melden", "Tour beenden und Prüfung auslösen."],
] as const;

export default function DistributorPage() {
  return (
    <MarketingPage>
      <section className="mkHero" aria-labelledby="distributor-hero-title">
        <PremiumFlyerField />
        <MarketingContainer className="mkHeroLayout">
          <div className="mkHeroCopy">
            <p className="mkEyebrow">Für Verteiler</p>
            <h1 id="distributor-hero-title">Flexibel verteilen. Sauber dokumentieren.</h1>
            <p className="mkHeroLead">
              Verteiler erhalten passende Touren, holen Flyer per QR-Code ab und liefern die Nachweise
              sauber für die Admin-Prüfung. Vor Freischaltung wird jedes Profil geprüft.
            </p>
            <div className="mkHeroActions">
              <MarketingButton href="/register/distributor">Als Verteiler registrieren</MarketingButton>
              <MarketingButton href="/login" variant="ghost">Zum Login</MarketingButton>
            </div>
            <div className="mkTrustRow">
              <TrustBadge icon={defaultProofIcons.gps}>GPS-Nachweise</TrustBadge>
              <TrustBadge icon={defaultProofIcons.camera}>Foto-Nachweise</TrustBadge>
              <TrustBadge icon={defaultProofIcons.shield}>Admin-Prüfung</TrustBadge>
            </div>
          </div>
          <ProofMockup area="Verteiler-Tour" />
        </MarketingContainer>
      </section>

      <MarketingSection eyebrow="Arbeiten mit FLYERO" title="Alles, was Verteiler unterwegs brauchen.">
        <div className="mkGrid mkGrid-4">
          {workItems.map(([title, text, Icon], index) => (
            <FeatureCard key={title} title={title} text={text} icon={Icon} index={index} />
          ))}
        </div>
      </MarketingSection>

      <MarketingSection eyebrow="Freischaltung" title="Von der Registrierung bis zur ersten Tour." tone="green">
        <ol className="mkSteps">
          {steps.map(([title, text], index) => (
            <StepCard key={title} title={title} text={text} index={index} />
          ))}
        </ol>
      </MarketingSection>

      <MarketingSection eyebrow="Interesse" title="Als Verteiler anfragen.">
        <div className="mkLeadPanel">
          <LeadForm defaultType="DISTRIBUTOR" source="fuer-verteiler" />
        </div>
      </MarketingSection>
    </MarketingPage>
  );
}
