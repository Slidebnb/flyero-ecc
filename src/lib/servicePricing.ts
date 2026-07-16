import { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SERVICE_PRICING_VERSION = "service-pricing-v1";
export const PRICING_CONFIGURATION_VERSION = "pricing-config-v1";

export const WEIGHT_FACTORS = {
  LIGHT: new Prisma.Decimal("1.00"),
  STANDARD: new Prisma.Decimal("1.08"),
  MEDIUM: new Prisma.Decimal("1.18"),
  HEAVY: new Prisma.Decimal("1.35"),
  CUSTOM: null,
} as const;

export const AREA_DIFFICULTY_FACTORS = {
  NORMAL: new Prisma.Decimal("1.00"),
  MIXED: new Prisma.Decimal("1.15"),
  LOW_DENSITY: new Prisma.Decimal("1.25"),
  RURAL: new Prisma.Decimal("1.40"),
  HARD: new Prisma.Decimal("1.60"),
} as const;

export const DEFAULT_PRICING_SETTINGS = {
  expressSurchargePercent: { key: "express_surcharge_percent", value: "20.00", description: "Expresszuschlag bei weniger als sieben Tagen in Prozent." },
  express72hSurchargePercent: { key: "express_72h_surcharge_percent", value: "35.00", description: "Expresszuschlag bei weniger als 72 Stunden in Prozent." },
  weekendSurchargePercent: { key: "weekend_surcharge_percent", value: "25.00", description: "Wochenend- oder Feiertagszuschlag in Prozent." },
  additionalAreaFeeNet: { key: "additional_area_fee_net", value: "49.00", description: "Zuschlag je weiterem getrennten Gebiet netto." },
  pickupFeeNet: { key: "pickup_fee_net", value: "49.00", description: "Abholung beim Kunden netto." },
  storageFeeNet: { key: "storage_fee_net", value: "29.00", description: "Lagerung je definierter Einheit netto." },
  handlingFeeNet: { key: "handling_fee_net", value: "0.00", description: "Allgemeine Bearbeitungsgebühr netto." },
  samplingHandlingFeePerUnit: { key: "sampling_handling_fee_per_unit", value: "0.15", description: "Handling je Produktprobe netto." },
  weightLightFactor: { key: "weight_factor_light", value: "1.00", description: "Gewichtsfaktor LIGHT." },
  weightStandardFactor: { key: "weight_factor_standard", value: "1.08", description: "Gewichtsfaktor STANDARD." },
  weightMediumFactor: { key: "weight_factor_medium", value: "1.18", description: "Gewichtsfaktor MEDIUM." },
  weightHeavyFactor: { key: "weight_factor_heavy", value: "1.35", description: "Gewichtsfaktor HEAVY." },
  areaNormalFactor: { key: "area_factor_normal", value: "1.00", description: "Gebietsfaktor NORMAL." },
  areaMixedFactor: { key: "area_factor_mixed", value: "1.15", description: "Gebietsfaktor MIXED." },
  areaLowDensityFactor: { key: "area_factor_low_density", value: "1.25", description: "Gebietsfaktor LOW_DENSITY." },
  areaRuralFactor: { key: "area_factor_rural", value: "1.40", description: "Gebietsfaktor RURAL." },
  areaHardFactor: { key: "area_factor_hard", value: "1.60", description: "Gebietsfaktor HARD." },
} as const;

type RuleDefinition = {
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: string;
  basePrice: string;
  minimumNetPrice: string;
};

export const SERVICE_PRICING_RULES: Record<string, RuleDefinition[]> = {
  [ServiceType.FLYER_STANDARD]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.38", basePrice: "0", minimumNetPrice: "599" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.34", basePrice: "1900", minimumNetPrice: "599" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.31", basePrice: "3600", minimumNetPrice: "599" },
  ],
  [ServiceType.CATALOG_DISTRIBUTION]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.55", basePrice: "0", minimumNetPrice: "799" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.49", basePrice: "2750", minimumNetPrice: "799" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.44", basePrice: "5200", minimumNetPrice: "799" },
  ],
  [ServiceType.BROCHURE_MAGAZINE]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.46", basePrice: "0", minimumNetPrice: "699" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.41", basePrice: "2300", minimumNetPrice: "699" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.37", basePrice: "4350", minimumNetPrice: "699" },
  ],
  [ServiceType.VOUCHER_CARD]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.40", basePrice: "0", minimumNetPrice: "599" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.36", basePrice: "2000", minimumNetPrice: "599" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.33", basePrice: "3800", minimumNetPrice: "599" },
  ],
  [ServiceType.POSTCARD_INVITATION]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.43", basePrice: "0", minimumNetPrice: "649" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.39", basePrice: "2150", minimumNetPrice: "649" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.35", basePrice: "4100", minimumNetPrice: "649" },
  ],
  [ServiceType.EVENT_INVITATION]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.45", basePrice: "0", minimumNetPrice: "699" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.41", basePrice: "2250", minimumNetPrice: "699" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.37", basePrice: "4300", minimumNetPrice: "699" },
  ],
  [ServiceType.COMMUNITY_PUBLICATION]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.48", basePrice: "0", minimumNetPrice: "699" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.43", basePrice: "2400", minimumNetPrice: "699" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.39", basePrice: "4550", minimumNetPrice: "699" },
  ],
  [ServiceType.MENU_DELIVERY_CARD]: [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.40", basePrice: "0", minimumNetPrice: "599" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.36", basePrice: "2000", minimumNetPrice: "599" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.33", basePrice: "3800", minimumNetPrice: "599" },
  ],
  [ServiceType.PRODUCT_SAMPLING]: [
    { minQuantity: 1, maxQuantity: 2000, pricePerUnit: "1.10", basePrice: "0", minimumNetPrice: "1499" },
    { minQuantity: 2001, maxQuantity: 5000, pricePerUnit: "0.95", basePrice: "2200", minimumNetPrice: "1499" },
    { minQuantity: 5001, maxQuantity: null, pricePerUnit: "0.85", basePrice: "5050", minimumNetPrice: "1499" },
  ],
};

export const SERVICE_PRICING_TYPES = Object.keys(SERVICE_PRICING_RULES) as ServiceType[];

export type PricingWeightClass = "LIGHT" | "STANDARD" | "MEDIUM" | "HEAVY" | "CUSTOM";
export type PricingAreaDifficulty = "NORMAL" | "MIXED" | "LOW_DENSITY" | "RURAL" | "HARD";

export function weightClassFromGrams(weightInGrams: number | null | undefined): PricingWeightClass {
  if (weightInGrams === null || weightInGrams === undefined) return "LIGHT";
  if (weightInGrams <= 20) return "LIGHT";
  if (weightInGrams <= 50) return "STANDARD";
  if (weightInGrams <= 100) return "MEDIUM";
  if (weightInGrams <= 250) return "HEAVY";
  return "CUSTOM";
}

export async function ensureDefaultServicePricingRules() {
  for (const serviceType of SERVICE_PRICING_TYPES) {
    for (const rule of SERVICE_PRICING_RULES[serviceType] ?? []) {
      const existing = await prisma.pricingRule.findFirst({
        where: { serviceType, minQuantity: rule.minQuantity, maxQuantity: rule.maxQuantity },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.pricingRule.create({
        data: {
          serviceType,
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
          pricePerUnit: new Prisma.Decimal(rule.pricePerUnit),
          basePrice: new Prisma.Decimal(rule.basePrice),
          minimumNetPrice: new Prisma.Decimal(rule.minimumNetPrice),
          pricingVersion: SERVICE_PRICING_VERSION,
          configurationVersion: PRICING_CONFIGURATION_VERSION,
          notes: "Standardregel aus der FLYERO-Servicekonfiguration.",
        },
      });
    }
  }
}
