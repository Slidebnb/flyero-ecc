import { SmartOrderWizard } from "@/app/customer/orders/new/SmartOrderWizard";
import { createSeoMetadata } from "@/app/seo";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung planen und Preis prüfen",
  description: "Gebiet auswählen, Flyeranzahl prüfen und eine transparente FLYERO Preisvorschau erhalten.",
  path: "/verteilung-planen",
  keywords: ["Flyerverteilung planen", "Flyer Preis berechnen", "Flyer Gebiet auswählen"],
});

export default function PublicDistributionPlannerPage() {
  return (
    <main className="orderExperienceShell publicPlannerShell">
      <header className="orderExperienceTopbar publicPlannerTopbar">
        <h1>Verteilung planen</h1>
        <span>Preisvorschau ohne Registrierung</span>
        <div className="orderTopActions" aria-label="Planeraktionen">
          <a href="/verteilung-anfragen">Anfrage senden</a>
          <a href="/login?next=%2Fcustomer%2Forders%2Fnew">Einloggen</a>
        </div>
      </header>
      <SmartOrderWizard areas={[]} today={new Date().toISOString().slice(0, 10)} mode="public_quote" />
    </main>
  );
}
