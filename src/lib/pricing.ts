import { Prisma, ServiceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPricingSettings, getSystemSettings, PRICING_SETTING_KEYS } from "@/lib/settings";

const VAT_SETTING_KEY = PRICING_SETTING_KEYS.vatRate;

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
  };
};

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
  const [rule, vatRate] = await Promise.all([
    getActivePricingRule(input.serviceType, input.flyerQuantity),
    getVatRate(),
  ]);

  const basePrice = rule?.basePrice ?? new Prisma.Decimal("0");
  const pricePerUnit = rule?.pricePerUnit ?? new Prisma.Decimal("0.12");
  const minimumNetPrice = rule?.minimumNetPrice ?? new Prisma.Decimal("250");
  const quantityPrice = basePrice.plus(pricePerUnit.mul(input.flyerQuantity));
  const net = Prisma.Decimal.max(quantityPrice, minimumNetPrice).toDecimalPlaces(2);
  const vat = net.mul(vatRate).toDecimalPlaces(2);
  const gross = net.plus(vat).toDecimalPlaces(2);

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
    },
  };
}

export async function ensureDefaultPricing() {
  await ensureDefaultPricingSettings();

  const rules = [
    { minQuantity: 1, maxQuantity: 2000, pricePerUnit: "0.14", basePrice: "0", minimumNetPrice: "250" },
    { minQuantity: 2001, maxQuantity: 5000, pricePerUnit: "0.12", basePrice: "0", minimumNetPrice: "250" },
    { minQuantity: 5001, maxQuantity: 10000, pricePerUnit: "0.105", basePrice: "0", minimumNetPrice: "250" },
    { minQuantity: 10001, maxQuantity: null, pricePerUnit: "0.095", basePrice: "0", minimumNetPrice: "250" },
  ];

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
    }
  }
}
