import { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPricingSettings, getSystemSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

const VAT_SETTING_KEY = PRICING_SETTING_KEYS.vatRate;
const PREMIUM_PRICING_VERSION = "premium-distribution-v4";
const MINIMUM_ORDER_VALUE_NET = new Prisma.Decimal("599");
const TIER_1_LIMIT = 5000;
const TIER_2_LIMIT = 10000;
const TIER_1_RATE = new Prisma.Decimal("0.38");
const TIER_2_RATE = new Prisma.Decimal("0.34");
const TIER_3_RATE = new Prisma.Decimal("0.31");
const AREA_DIFFICULTY_FACTORS = {
  NORMAL: new Prisma.Decimal("1.00"),
  MIXED: new Prisma.Decimal("1.15"),
  LOW_DENSITY: new Prisma.Decimal("1.25"),
  RURAL: new Prisma.Decimal("1.40"),
  HARD: new Prisma.Decimal("1.60"),
} as const;

export type PriceCalculation = {
  net: Prisma.Decimal;
  vat: Prisma.Decimal;
  gross: Prisma.Decimal;
  snapshot: {
    serviceType: ServiceType;
    flyerQuantity: number;
    basePrice: string;
    pricePerUnit: string;
    minimumNetPrice: string;
    vatRate: string;
    ruleId: string | null;
    pricingVersion: string;
    minimumOrderValueNet: string;
    tier1Rate: string;
    tier2Rate: string;
    tier3Rate: string;
    tier1Limit: number;
    tier2Limit: number;
    baseDistributionNet: string;
    areaDifficultyFactor: string;
    areaDifficulty: keyof typeof AREA_DIFFICULTY_FACTORS;
    surcharges: {
      expressSurchargePercent: number;
      weekendSurchargePercent: number;
      additionalAreaFeeNet: string;
      pickupFeeNet: string;
      storageFeeNet: string;
    };
    calculatedNet: string;
    calculatedGross: string;
    calculatedAt: string;
  };
};

type PricingRuleLike = {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: Prisma.Decimal;
  basePrice: Prisma.Decimal;
  minimumNetPrice: Prisma.Decimal;
};

export function calculatePremiumDistributionTierNetPrice(flyerQuantity: number) {
  const safeQuantity = Math.max(0, Math.floor(flyerQuantity));
  if (safeQuantity <= TIER_1_LIMIT) {
    return TIER_1_RATE.mul(safeQuantity).toDecimalPlaces(2);
  }
  if (safeQuantity <= TIER_2_LIMIT) {
    return TIER_1_RATE
      .mul(TIER_1_LIMIT)
      .plus(TIER_2_RATE.mul(safeQuantity - TIER_1_LIMIT))
      .toDecimalPlaces(2);
  }
  return TIER_1_RATE
    .mul(TIER_1_LIMIT)
    .plus(TIER_2_RATE.mul(TIER_2_LIMIT - TIER_1_LIMIT))
    .plus(TIER_3_RATE.mul(safeQuantity - TIER_2_LIMIT))
    .toDecimalPlaces(2);
}

export function calculatePremiumDistributionNetPrice(flyerQuantity: number) {
  return Prisma.Decimal.max(
    calculatePremiumDistributionTierNetPrice(flyerQuantity),
    MINIMUM_ORDER_VALUE_NET,
  ).toDecimalPlaces(2);
}

export async function getActivePricingRule(
  serviceType: ServiceType,
  flyerQuantity: number,
) {
  return prisma.pricingRule.findFirst({
    where: {
      serviceType,
      isActive: true,
      minQuantity: { lte: flyerQuantity },
      OR: [{ maxQuantity: null }, { maxQuantity: { gte: flyerQuantity } }],
    },
    orderBy: { minQuantity: "desc" },
  });
}

export async function getActivePricingRules(serviceType: ServiceType): Promise<PricingRuleLike[]> {
  return prisma.pricingRule.findMany({
    where: { serviceType, isActive: true },
    orderBy: { minQuantity: "asc" },
    select: {
      id: true,
      minQuantity: true,
      maxQuantity: true,
      pricePerUnit: true,
      basePrice: true,
      minimumNetPrice: true,
    },
  });
}

export function calculateConfiguredTierNetPrice(flyerQuantity: number, rules: PricingRuleLike[]) {
  const safeQuantity = Math.max(0, Math.floor(flyerQuantity));
  const rule = rules.find(
    (candidate) => candidate.minQuantity <= safeQuantity && (candidate.maxQuantity === null || candidate.maxQuantity >= safeQuantity),
  );
  if (!rule) {
    return calculatePremiumDistributionTierNetPrice(safeQuantity);
  }

  const unitsInTier = Math.max(0, safeQuantity - rule.minQuantity + 1);
  return rule.basePrice.plus(rule.pricePerUnit.mul(unitsInTier)).toDecimalPlaces(2);
}

export async function getVatRate() {
  await ensureDefaultPricingSettings();
  const setting = await prisma.pricingSetting.findUnique({
    where: { key: VAT_SETTING_KEY },
  });
  const system = await getSystemSettings();

  return setting?.valueDecimal ?? system.defaultVatRate;
}

export async function calculateOrderPrice(input: {
  serviceType: ServiceType;
  flyerQuantity: number;
}): Promise<PriceCalculation> {
  const [rules, vatRate] = await Promise.all([
    getActivePricingRules(input.serviceType),
    getVatRate(),
  ]);

  const rule = rules.find(
    (candidate) => candidate.minQuantity <= input.flyerQuantity && (candidate.maxQuantity === null || candidate.maxQuantity >= input.flyerQuantity),
  );
  const basePrice = rule?.basePrice ?? new Prisma.Decimal("0");
  const pricePerUnit = rule?.pricePerUnit ?? TIER_1_RATE;
  const minimumNetPrice = rule?.minimumNetPrice ?? MINIMUM_ORDER_VALUE_NET;
  const baseDistributionNet = rules.length
    ? calculateConfiguredTierNetPrice(input.flyerQuantity, rules)
    : calculatePremiumDistributionTierNetPrice(input.flyerQuantity);
  const areaDifficulty = "NORMAL" as const;
  const areaDifficultyFactor = AREA_DIFFICULTY_FACTORS[areaDifficulty];
  const calculatedNet = baseDistributionNet.mul(areaDifficultyFactor).toDecimalPlaces(2);
  const net = Prisma.Decimal.max(calculatedNet, minimumNetPrice).toDecimalPlaces(2);
  const vat = net.mul(vatRate).toDecimalPlaces(2);
  const gross = net.plus(vat).toDecimalPlaces(2);
  const tier1 = rules[0];
  const tier2 = rules[1];
  const tier3 = rules[2];

  return {
    net,
    vat,
    gross,
    snapshot: {
      serviceType: input.serviceType,
      flyerQuantity: input.flyerQuantity,
      basePrice: basePrice.toString(),
      pricePerUnit: pricePerUnit.toString(),
      minimumNetPrice: minimumNetPrice.toString(),
      vatRate: vatRate.toString(),
      ruleId: rule?.id ?? null,
      pricingVersion: PREMIUM_PRICING_VERSION,
      minimumOrderValueNet: minimumNetPrice.toString(),
      tier1Rate: tier1?.pricePerUnit.toString() ?? TIER_1_RATE.toString(),
      tier2Rate: tier2?.pricePerUnit.toString() ?? TIER_2_RATE.toString(),
      tier3Rate: tier3?.pricePerUnit.toString() ?? TIER_3_RATE.toString(),
      tier1Limit: tier1?.maxQuantity ?? TIER_1_LIMIT,
      tier2Limit: tier2?.maxQuantity ?? TIER_2_LIMIT,
      baseDistributionNet: baseDistributionNet.toString(),
      areaDifficultyFactor: areaDifficultyFactor.toString(),
      areaDifficulty,
      surcharges: {
        expressSurchargePercent: 30,
        weekendSurchargePercent: 25,
        additionalAreaFeeNet: "49",
        pickupFeeNet: "49",
        storageFeeNet: "29",
      },
      calculatedNet: net.toString(),
      calculatedGross: gross.toString(),
      calculatedAt: new Date().toISOString(),
    },
  };
}

export async function ensureDefaultPricing() {
  await ensureDefaultPricingSettings();

  const rules = [
    { minQuantity: 1, maxQuantity: 5000, pricePerUnit: "0.38", basePrice: "0", minimumNetPrice: "599" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.34", basePrice: "1900", minimumNetPrice: "599" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.31", basePrice: "3600", minimumNetPrice: "599" },
  ];

  await prisma.pricingRule.updateMany({
    where: { serviceType: "FLYER_DISTRIBUTION" },
    data: { isActive: false },
  });

  for (const rule of rules) {
    const existing = await prisma.pricingRule.findFirst({
      where: {
        serviceType: "FLYER_DISTRIBUTION",
        minQuantity: rule.minQuantity,
        maxQuantity: rule.maxQuantity,
      },
    });

    if (!existing) {
      await prisma.pricingRule.create({
        data: {
          serviceType: "FLYER_DISTRIBUTION",
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
          pricePerUnit: new Prisma.Decimal(rule.pricePerUnit),
          basePrice: new Prisma.Decimal(rule.basePrice),
          minimumNetPrice: new Prisma.Decimal(rule.minimumNetPrice),
        },
      });
    } else {
      await prisma.pricingRule.update({
        where: { id: existing.id },
        data: {
          pricePerUnit: new Prisma.Decimal(rule.pricePerUnit),
          basePrice: new Prisma.Decimal(rule.basePrice),
          minimumNetPrice: new Prisma.Decimal(rule.minimumNetPrice),
          isActive: true,
        },
      });
    }
  }
}
