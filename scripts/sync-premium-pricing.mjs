import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL fehlt.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const premiumRules = [
  { minQuantity: 1, maxQuantity: 5000, basePrice: "0", pricePerUnit: "0.38", minimumNetPrice: "599" },
  { minQuantity: 5001, maxQuantity: 10000, basePrice: "1900", pricePerUnit: "0.34", minimumNetPrice: "599" },
  { minQuantity: 10001, maxQuantity: null, basePrice: "3600", pricePerUnit: "0.31", minimumNetPrice: "599" },
];

try {
  await prisma.$transaction(async (tx) => {
    await tx.pricingRule.updateMany({
      where: { serviceType: "FLYER_DISTRIBUTION" },
      data: { isActive: false },
    });

    for (const rule of premiumRules) {
      const existing = await tx.pricingRule.findFirst({
        where: {
          serviceType: "FLYER_DISTRIBUTION",
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
        },
      });

      const data = {
        serviceType: "FLYER_DISTRIBUTION",
        minQuantity: rule.minQuantity,
        maxQuantity: rule.maxQuantity,
        basePrice: new Prisma.Decimal(rule.basePrice),
        pricePerUnit: new Prisma.Decimal(rule.pricePerUnit),
        minimumNetPrice: new Prisma.Decimal(rule.minimumNetPrice),
        isActive: true,
      };

      if (existing) {
        await tx.pricingRule.update({ where: { id: existing.id }, data });
      } else {
        await tx.pricingRule.create({ data });
      }
    }
  });

  const activeRules = await prisma.pricingRule.findMany({
    where: { serviceType: "FLYER_DISTRIBUTION", isActive: true },
    orderBy: { minQuantity: "asc" },
    select: { minQuantity: true, maxQuantity: true, basePrice: true, pricePerUnit: true, minimumNetPrice: true },
  });

  if (activeRules.length !== premiumRules.length) {
    throw new Error(`Erwartet wurden ${premiumRules.length} aktive Regeln, gefunden: ${activeRules.length}.`);
  }

  for (const [index, expected] of premiumRules.entries()) {
    const actual = activeRules[index];
    const matches =
      actual.minQuantity === expected.minQuantity &&
      actual.maxQuantity === expected.maxQuantity &&
      actual.basePrice.toString() === expected.basePrice &&
      actual.pricePerUnit.toString() === expected.pricePerUnit &&
      actual.minimumNetPrice.toString() === expected.minimumNetPrice;
    if (!matches) {
      throw new Error(`Preisregel ${expected.minQuantity}-${expected.maxQuantity ?? "open"} wurde nicht korrekt synchronisiert.`);
    }
  }

  console.log("Premium-Preisregeln erfolgreich synchronisiert.");
  console.table(activeRules.map((rule) => ({
    staffel: `${rule.minQuantity}-${rule.maxQuantity ?? "offen"}`,
    basis: rule.basePrice.toString(),
    jeFlyer: rule.pricePerUnit.toString(),
    mindestpreis: rule.minimumNetPrice.toString(),
  })));
} finally {
  await prisma.$disconnect();
}
