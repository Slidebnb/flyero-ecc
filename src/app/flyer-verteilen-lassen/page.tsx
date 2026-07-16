import type { Metadata } from "next";
import { FlyerDistributionPillarPage } from "@/app/components/marketing";
import { absoluteUrl, createSeoMetadata } from "@/app/seo";

export const metadata: Metadata = createSeoMetadata({
  title: "Flyer verteilen lassen in Deutschland",
  description: "Flyer verteilen lassen: Gebiet auswählen, eigene gedruckte Flyer anliefern, online buchen oder unverbindlich anfragen und Nachweise im Kundenkonto erhalten.",
  path: "/flyer-verteilen-lassen",
  keywords: ["Flyer verteilen lassen", "Flyer online buchen", "Flyerverteilung Deutschland", "Flyer professionell verteilen"],
});

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Flyer verteilen lassen mit FLYERO",
    description: "Gebietsplanung, Flyeranlieferung, Flyerverteilung und geprüfte Nachweise für Unternehmen und Organisationen.",
    serviceType: "Flyerverteilung",
    provider: { "@type": "Organization", name: "FLYERO", url: absoluteUrl("/") },
    areaServed: { "@type": "Country", name: "Deutschland" },
    url: absoluteUrl("/flyer-verteilen-lassen"),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "FLYERO", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Flyer verteilen lassen", item: absoluteUrl("/flyer-verteilen-lassen") },
    ],
  },
];

export default function FlyerDistributionPillarRoute() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FlyerDistributionPillarPage />
    </>
  );
}
