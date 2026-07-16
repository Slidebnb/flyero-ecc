import { SmartOrderWizard } from "@/app/customer/orders/new/SmartOrderWizard";
import { createSeoMetadata } from "@/app/seo";
import { MobileMenu } from "@/app/components/MobileMenu";
import { normalizePublicLocationContext, type PublicLocationContext } from "@/lib/publicLocationContext";

export const metadata = createSeoMetadata({
  title: "Flyerverteilung planen und Preis prüfen",
  description: "Gebiet auswählen, Flyeranzahl prüfen und eine transparente FLYERO Preisvorschau erhalten.",
  path: "/verteilung-planen",
  keywords: ["Flyerverteilung planen", "Flyer Preis berechnen", "Flyer Gebiet auswählen"],
});

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PublicDistributionPlannerPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const initialLocation: PublicLocationContext | null = normalizePublicLocationContext({
    query: firstSearchParam(params.query),
    placeId: firstSearchParam(params.placeId),
    postalCode: firstSearchParam(params.postalCode),
    city: firstSearchParam(params.city),
    lat: firstSearchParam(params.lat),
    lng: firstSearchParam(params.lng),
    source: firstSearchParam(params.source),
  });

  return (
    <main className="orderExperienceShell publicPlannerShell">
      <header className="orderExperienceTopbar publicPlannerTopbar">
        <h1>Verteilung planen</h1>
        <p>Adresse, Ort oder PLZ eingeben und Gebiet sowie Preis prüfen.</p>
        <span>Preisvorschau ohne Registrierung</span>
        <div className="orderTopActions" aria-label="Planeraktionen">
          <a href="/verteilung-anfragen">Anfrage senden</a>
          <a href="/login?next=%2Fcustomer%2Forders%2Fnew">Einloggen</a>
        </div>
        <MobileMenu
          items={[
            { label: "FLYERO Start", href: "/" },
            { label: "Preise", href: "/preise" },
            { label: "Anfrage senden", href: "/verteilung-anfragen" },
          ]}
          cta={{ label: "Einloggen", href: "/login?next=%2Fcustomer%2Forders%2Fnew" }}
        />
      </header>
      <SmartOrderWizard areas={[]} today={new Date().toISOString().slice(0, 10)} mode="public_quote" initialLocation={initialLocation} />
    </main>
  );
}
