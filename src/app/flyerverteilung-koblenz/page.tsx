import type { Metadata } from "next";
import { SeoIntentPage, createSeoIntentJsonLd } from "@/app/components/marketing/SeoIntentPage";
import { absoluteUrl, createSeoMetadata } from "@/app/seo";
import { seoIntentPageByPath } from "@/app/seoIntentData";

const page = seoIntentPageByPath.get("/flyerverteilung-koblenz")!;

export const metadata: Metadata = createSeoMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  keywords: page.keywords,
});

export default function FlyerverteilungKoblenzPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(createSeoIntentJsonLd(page, absoluteUrl)) }} />
      <SeoIntentPage page={page} />
    </>
  );
}
