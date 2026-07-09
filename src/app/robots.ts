import type { MetadataRoute } from "next";
import { absoluteUrl, siteUrl } from "@/app/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/verteilung-anfragen",
          "/fuer-unternehmen",
          "/fuer-verteiler",
          "/so-funktionierts",
          "/preise",
          "/kontakt",
          "/impressum",
          "/datenschutz",
          "/agb",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/customer/",
          "/warehouse/",
          "/distributor/",
          "/mock-stripe/",
          "/login",
          "/register/",
          "/verify-email",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: siteUrl,
  };
}
