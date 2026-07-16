import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IndustryLandingPage } from "@/app/components/marketing";
import { occasionPageBySlug, occasionPages } from "@/app/anlaesse/occasionData";
import { absoluteUrl, createSeoMetadata } from "@/app/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return occasionPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = occasionPageBySlug.get(slug);
  if (!page) return {};
  return createSeoMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    keywords: page.keywords,
  });
}

function occasionJsonLd(page: (typeof occasionPages)[number]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: page.title,
      description: page.description,
      serviceType: "Flyerverteilung",
      provider: { "@type": "Organization", name: "FLYERO", url: absoluteUrl("/") },
      areaServed: { "@type": "Country", name: "Deutschland" },
      url: absoluteUrl(page.path),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "FLYERO", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Anlässe", item: absoluteUrl("/flyer-verteilen-lassen") },
        { "@type": "ListItem", position: 3, name: page.label, item: absoluteUrl(page.path) },
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

export default async function OccasionPage({ params }: PageProps) {
  const { slug } = await params;
  const page = occasionPageBySlug.get(slug);
  if (!page) notFound();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(occasionJsonLd(page)) }} />
      <IndustryLandingPage page={page} />
    </>
  );
}
