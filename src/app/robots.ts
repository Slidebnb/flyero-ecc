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
          "/branchen",
          "/flyer-fuer",
          "/flyer-verteilen-lassen",
          "/flyerverteilung",
          "/flyerverteilung-bendorf",
          "/flyerverteilung-koblenz",
          "/flyerverteilung-neuwied",
          "/prospektverteilung",
          "/haushaltswerbung",
          "/flyerverteilung-mit-gps-nachweis",
          "/bundesweite-flyerverteilung",
          "/flyerverteilung-kosten",
          "/gps-nachweis",
          "/qualitaetssicherung",
          "/haeufige-fragen",
          "/ratgeber",
          "/ratgeber/flyerverteilung-planen",
          "/ratgeber/richtige-flyer-auflage",
          "/ratgeber/verteilgebiet-bestimmen",
          "/ratgeber/flyerverteilung-kontrollieren",
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
