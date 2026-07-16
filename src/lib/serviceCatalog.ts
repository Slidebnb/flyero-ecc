import type { ServiceType } from "@prisma/client";

export type OnlineServiceType =
  | "FLYER_STANDARD"
  | "CATALOG_DISTRIBUTION"
  | "BROCHURE_MAGAZINE"
  | "VOUCHER_CARD"
  | "POSTCARD_INVITATION"
  | "EVENT_INVITATION"
  | "COMMUNITY_PUBLICATION"
  | "MENU_DELIVERY_CARD"
  | "PRODUCT_SAMPLING";

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
    serviceType: "FLYER_STANDARD",
    slug: "flyer-standard",
    label: "Prospekte & Angebotsblätter",
    shortLabel: "Prospekte",
    description: "Bereits gedruckte Prospekte und Angebotsblätter im gewünschten Gebiet verteilen lassen.",
    bookingLabel: "Prospekte verteilen",
    formatLabel: "Prospektformat",
    keywords: ["Flyerverteilung", "Prospektverteilung", "Angebotsblätter"],
    bookingAvailable: true,
  },
  {
    serviceType: "CATALOG_DISTRIBUTION",
    slug: "kataloge",
    label: "Kataloge",
    shortLabel: "Kataloge",
    description: "Kataloge mit größerem Umfang planbar in deinem Gebiet verteilen lassen.",
    bookingLabel: "Kataloge verteilen",
    formatLabel: "Katalogformat",
    keywords: ["Katalogverteilung", "Kataloge verteilen", "Direktwerbung"],
    bookingAvailable: true,
  },
  {
    serviceType: "BROCHURE_MAGAZINE",
    slug: "broschueren-magazine",
    label: "Broschüren & Magazine",
    shortLabel: "Broschüren",
    description: "Mehrseitige Broschüren und Magazine regional an passende Haushalte verteilen.",
    bookingLabel: "Broschüren verteilen",
    formatLabel: "Broschürenformat",
    keywords: ["Broschüren verteilen", "Magazinverteilung", "Prospektverteilung"],
    bookingAvailable: true,
  },
  {
    serviceType: "VOUCHER_CARD",
    slug: "gutscheinkarten",
    label: "Gutscheinkarten",
    shortLabel: "Gutscheinkarten",
    description: "Gutscheine und Angebotskarten gezielt in deinem Verteilgebiet zustellen lassen.",
    bookingLabel: "Gutscheinkarten verteilen",
    formatLabel: "Kartenformat",
    keywords: ["Gutscheinkarten verteilen", "Gutscheinverteilung", "Angebotskarten"],
    bookingAvailable: true,
  },
  {
    serviceType: "POSTCARD_INVITATION",
    slug: "postkarten-einladungskarten",
    label: "Postkarten & Einladungskarten",
    shortLabel: "Postkarten",
    description: "Postkarten und Einladungskarten mit klarer Gebietsauswahl verteilen lassen.",
    bookingLabel: "Postkarten verteilen",
    formatLabel: "Kartenformat",
    keywords: ["Postkarten verteilen", "Einladungskarten", "Postkartenverteilung"],
    bookingAvailable: true,
  },
  {
    serviceType: "EVENT_INVITATION",
    slug: "veranstaltungseinladungen",
    label: "Veranstaltungseinladungen",
    shortLabel: "Einladungen",
    description: "Einladungen für Veranstaltungen, Eröffnungen und Aktionen regional zustellen lassen.",
    bookingLabel: "Einladungen verteilen",
    formatLabel: "Einladungsformat",
    keywords: ["Veranstaltungseinladungen", "Eventwerbung", "Einladungen verteilen"],
    bookingAvailable: true,
  },
  {
    serviceType: "COMMUNITY_PUBLICATION",
    slug: "vereins-gemeindeblaetter",
    label: "Vereins- & Gemeindeblätter",
    shortLabel: "Gemeindeblätter",
    description: "Vereins- und Gemeindepublikationen zuverlässig in den passenden Gebieten verteilen.",
    bookingLabel: "Publikationen verteilen",
    formatLabel: "Publikationsformat",
    keywords: ["Vereinsblätter verteilen", "Gemeindeblätter", "Publikationsverteilung"],
    bookingAvailable: true,
  },
  {
    serviceType: "MENU_DELIVERY_CARD",
    slug: "speisekarten-lieferkarten",
    label: "Speisekarten & Lieferkarten",
    shortLabel: "Lieferkarten",
    description: "Speisekarten und Lieferkarten im lokalen Liefergebiet verteilen lassen.",
    bookingLabel: "Lieferkarten verteilen",
    formatLabel: "Kartenformat",
    keywords: ["Speisekarten verteilen", "Lieferkarten", "Gastronomie-Werbung"],
    bookingAvailable: true,
  },
  {
    serviceType: "PRODUCT_SAMPLING",
    slug: "produktproben-sampling",
    label: "Produktproben & Sampling",
    shortLabel: "Sampling",
    description: "Produktproben mit Mengen-, Verpackungs- und Übergabeanforderungen professionell planen.",
    bookingLabel: "Sampling anfragen",
    formatLabel: "Produktprobe",
    keywords: ["Produktproben verteilen", "Sampling", "Promotion-Verteilung"],
    bookingAvailable: true,
  },
] as const;

export const inquiryOnlyServices: readonly InquiryOnlyService[] = [];

const legacyServiceMap: Record<string, OnlineServiceType> = {
  FLYER_DISTRIBUTION: "FLYER_STANDARD",
  DOOR_HANGER: "FLYER_STANDARD",
  BROCHURE: "BROCHURE_MAGAZINE",
  MAGAZINE: "BROCHURE_MAGAZINE",
};

export function isOnlineServiceType(value: unknown): value is OnlineServiceType {
  return distributionServiceCatalog.some((item) => item.serviceType === value);
}

export function normalizeOnlineServiceType(value: unknown): OnlineServiceType {
  if (isOnlineServiceType(value)) return value;
  return legacyServiceMap[String(value ?? "")] ?? "FLYER_STANDARD";
}

export function serviceCatalogItem(serviceType: ServiceType | string): ServiceCatalogItem {
  const normalized = normalizeOnlineServiceType(serviceType);
  return distributionServiceCatalog.find((item) => item.serviceType === normalized) ?? distributionServiceCatalog[0];
}

export function serviceCatalogLabel(serviceType: ServiceType | string) {
  return serviceCatalogItem(serviceType).label;
}
