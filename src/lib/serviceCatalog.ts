import type { ServiceType } from "@prisma/client";

export type OnlineServiceType = "FLYER_DISTRIBUTION" | "DOOR_HANGER" | "BROCHURE" | "MAGAZINE";

export type ServiceCatalogItem = {
  serviceType: OnlineServiceType;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  bookingLabel: string;
  formatLabel: string;
  keywords: string[];
  bookingAvailable: true;
};

export type InquiryOnlyService = {
  slug: string;
  label: string;
  description: string;
  keywords: string[];
  bookingAvailable: false;
};

export const distributionServiceCatalog: readonly ServiceCatalogItem[] = [
  {
    serviceType: "FLYER_DISTRIBUTION",
    slug: "flyer",
    label: "Flyer",
    shortLabel: "Flyer",
    description: "Bereits gedruckte Flyer im gewünschten Gebiet verteilen lassen.",
    bookingLabel: "Flyer verteilen",
    formatLabel: "Flyerformat",
    keywords: ["Flyerverteilung", "Werbeflyer", "Prospektverteilung"],
    bookingAvailable: true,
  },
  {
    serviceType: "DOOR_HANGER",
    slug: "tuerhaenger",
    label: "Türhänger",
    shortLabel: "Türhänger",
    description: "Türhänger gezielt an Haushalten in deinem Verteilgebiet anbringen lassen.",
    bookingLabel: "Türhänger verteilen",
    formatLabel: "Ausführung",
    keywords: ["Türhänger verteilen", "Türanhänger", "Haushaltswerbung"],
    bookingAvailable: true,
  },
  {
    serviceType: "BROCHURE",
    slug: "prospekte-broschueren",
    label: "Prospekte & Broschüren",
    shortLabel: "Prospekte",
    description: "Mehrseitige Prospekte und Broschüren regional an passende Haushalte verteilen.",
    bookingLabel: "Prospekte verteilen",
    formatLabel: "Ausführung",
    keywords: ["Prospektverteilung", "Broschüren verteilen", "Katalogverteilung"],
    bookingAvailable: true,
  },
  {
    serviceType: "MAGAZINE",
    slug: "magazine",
    label: "Magazine",
    shortLabel: "Magazine",
    description: "Magazine, Vereins- und Kundenpublikationen zuverlässig im Gebiet auslegen oder verteilen.",
    bookingLabel: "Magazine verteilen",
    formatLabel: "Ausführung",
    keywords: ["Magazinverteilung", "Vereinsmagazine", "Kundenmagazine"],
    bookingAvailable: true,
  },
] as const;

export const inquiryOnlyServices: readonly InquiryOnlyService[] = [
  {
    slug: "sampling",
    label: "Warenproben & Sampling",
    description: "Produktproben und Promotions an passenden Orten oder bei Veranstaltungen verteilen lassen.",
    keywords: ["Sampling", "Produktproben verteilen", "Promotion-Verteilung"],
    bookingAvailable: false,
  },
  {
    slug: "postkarten-gutscheinkarten",
    label: "Postkarten & Gutscheinkarten",
    description: "Postkarten, Gutscheinkarten und Einladungskarten im gewünschten Gebiet zustellen lassen.",
    keywords: ["Gutscheinkarten verteilen", "Postkarten verteilen", "Einladungskarten"],
    bookingAvailable: false,
  },
];

export function serviceCatalogItem(serviceType: ServiceType | string) {
  return distributionServiceCatalog.find((item) => item.serviceType === serviceType) ?? distributionServiceCatalog[0];
}

export function serviceCatalogLabel(serviceType: ServiceType | string) {
  return serviceCatalogItem(serviceType).label;
}
