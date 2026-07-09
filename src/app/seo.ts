import type { Metadata } from "next";

const siteName = "FLYERO";
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://flyero.de";
export const siteUrl = baseUrl.replace(/\/$/, "");

type SeoInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
};

export function createSeoMetadata({ title, description, path = "/", keywords = [] }: SeoInput): Metadata {
  const canonical = new URL(path, baseUrl).toString();
  return {
    title,
    description,
    keywords: [
      "Flyerverteilung",
      "Flyer verteilen lassen",
      "GPS Nachweis",
      "Koblenz",
      "Verteilgebiet",
      ...keywords,
    ],
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      locale: "de_DE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "FLYERO - Flyerverteilung mit Nachweis",
    template: "%s | FLYERO",
  },
  description: "Flyerverteilung online anfragen, Gebiet planen, Auftrag buchen und Nachweise im Kundenportal erhalten.",
  applicationName: siteName,
  appleWebApp: {
    capable: true,
    title: "FLYERO Verteiler",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png", sizes: "512x512" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const publicSeoRoutes = [
  { path: "/", priority: 1, changeFrequency: "weekly" as const },
  { path: "/verteilung-anfragen", priority: 0.95, changeFrequency: "weekly" as const },
  { path: "/fuer-unternehmen", priority: 0.85, changeFrequency: "monthly" as const },
  { path: "/so-funktionierts", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/preise", priority: 0.75, changeFrequency: "monthly" as const },
  { path: "/fuer-verteiler", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/kontakt", priority: 0.65, changeFrequency: "monthly" as const },
  { path: "/impressum", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/datenschutz", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/agb", priority: 0.2, changeFrequency: "yearly" as const },
];

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export function absoluteUrl(path: string) {
  return new URL(path, `${siteUrl}/`).toString();
}

export function createJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon"),
      sameAs: [],
      areaServed: {
        "@type": "Country",
        name: "Deutschland",
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: "DE",
        availableLanguage: ["de"],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: absoluteUrl("/"),
      inLanguage: "de-DE",
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Flyerverteilung mit GPS-Nachweis",
      provider: {
        "@type": "Organization",
        name: siteName,
        url: absoluteUrl("/"),
      },
      serviceType: "Flyerverteilung",
      areaServed: {
        "@type": "Country",
        name: "Deutschland",
      },
      description:
        "FLYERO unterstützt Unternehmen bei der Planung, Buchung, Lagerung, Verteilung und Dokumentation von Flyerkampagnen.",
      offers: {
        "@type": "Offer",
        url: absoluteUrl("/preise"),
        availability: "https://schema.org/InStock",
      },
    },
  ];
}
