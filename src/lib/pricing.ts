import { createHash } from "node:crypto";
import Stripe from "stripe";
import { PaymentStatus, Prisma, ServiceType } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
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
    pricingRuleSignature: string;
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

export type PricingRuleChange = {
  id?: string;
  serviceType: ServiceType;
  minQuantity: number;
  maxQuantity: number | null;
  pricePerUnit: Prisma.Decimal | string | number;
  basePrice: Prisma.Decimal | string | number;
  minimumNetPrice: Prisma.Decimal | string | number;
  isActive: boolean;
};

const OPEN_PRICE_ORDER_STATUSES = [
  "DRAFT",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "SUBMITTED",
  "WAITING_FOR_CUSTOMER",
] as const;

const SETTLED_PAYMENT_STATUSES = ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
const OPEN_CHECKOUT_PAYMENT_STATUSES: PaymentStatus[] = ["CREATED", "CHECKOUT_CREATED", "PENDING"];

async function expireExternalCheckoutSession(sessionId: string | null) {
  if (!sessionId || sessionId.startsWith("cs_test_mock_")) return false;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return false;

  try {
    const stripe = new Stripe(secret, { apiVersion: "2026-06-24.dahlia" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status === "open") await stripe.checkout.sessions.expire(sessionId);
    return true;
  } catch {
    // The local payment state is still invalidated below. Stripe retries or
    // the next checkout request must never reuse the old amount.
    return false;
  }
}

function decimal(value: Prisma.Decimal | string | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function calculatePriceFromNet(
  netValue: Prisma.Decimal | string | number,
  vatRateValue: Prisma.Decimal | string | number,
) {
  const net = decimal(netValue).toDecimalPlaces(2);
  const vat = net.mul(decimal(vatRateValue)).toDecimalPlaces(2);
  return { net, vat, gross: net.plus(vat).toDecimalPlaces(2) };
}

export function getOrderGrossPrice(input: {
  manualPriceOverride: unknown;
  calculatedGrossPrice: unknown;
  priceRuleSnapshot?: unknown;
}) {
  const calculatedGross = decimal(String(input.calculatedGrossPrice ?? "0"));
  if (input.manualPriceOverride === null || input.manualPriceOverride === undefined) return calculatedGross;
  const snapshot = input.priceRuleSnapshot && typeof input.priceRuleSnapshot === "object" && !Array.isArray(input.priceRuleSnapshot)
    ? input.priceRuleSnapshot as Record<string, unknown>
    : {};
  if (typeof snapshot.manualCalculatedGross === "string") return decimal(snapshot.manualCalculatedGross);
  const vatRate = typeof snapshot.manualVatRate === "string" || typeof snapshot.manualVatRate === "number"
    ? snapshot.manualVatRate
    : typeof snapshot.vatRate === "string" || typeof snapshot.vatRate === "number"
      ? snapshot.vatRate
      : "0.19";
  return calculatePriceFromNet(String(input.manualPriceOverride), vatRate).gross;
}

function activeRuleValidationMessage(rules: PricingRuleChange[]) {
  const ordered = [...rules].sort((left, right) => left.minQuantity - right.minQuantity);
  if (!ordered.length) return "Mindestens eine aktive Preisregel ist erforderlich.";

  for (const rule of ordered) {
    if (!Number.isInteger(rule.minQuantity) || rule.minQuantity < 1) {
      return "Die Mindestmenge einer Preisregel muss eine positive ganze Zahl sein.";
    }
    if (rule.maxQuantity !== null && (!Number.isInteger(rule.maxQuantity) || rule.maxQuantity < rule.minQuantity)) {
      return "Die Maximalmenge einer Preisregel ist ungueltig.";
    }
    if (decimal(rule.pricePerUnit).isNegative() || decimal(rule.basePrice).isNegative() || decimal(rule.minimumNetPrice).isNegative()) {
      return "Preisregeln duerfen keine negativen Werte enthalten.";
    }
  }

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous.maxQuantity === null || current.minQuantity <= previous.maxQuantity) {
      return "Aktive Preisregeln duerfen sich nicht ueberschneiden.";
    }
    if (previous.serviceType === ServiceType.FLYER_DISTRIBUTION && current.serviceType === ServiceType.FLYER_DISTRIBUTION && current.minQuantity !== previous.maxQuantity + 1) {
      return "Die Flyer-Staffel muss ohne Luecken aufeinanderfolgen.";
    }

    const previousEnd = decimal(previous.basePrice).plus(decimal(previous.pricePerUnit).mul(previous.maxQuantity === null ? previous.minQuantity : previous.maxQuantity - previous.minQuantity + 1));
    const currentStart = decimal(current.basePrice).plus(decimal(current.pricePerUnit));
    const previousEffective = Prisma.Decimal.max(previousEnd, decimal(previous.minimumNetPrice));
    const currentEffective = Prisma.Decimal.max(currentStart, decimal(current.minimumNetPrice));
    if (currentEffective.lessThan(previousEffective)) {
      return "Die Preisstaffel darf an einer Schwelle nicht guenstiger werden.";
    }
  }

  if (ordered[0]?.serviceType === ServiceType.FLYER_DISTRIBUTION && ordered[ordered.length - 1]?.maxQuantity !== null) {
    return "Die letzte Flyer-Staffel muss nach oben offen sein.";
  }

  return null;
}

export async function validatePricingRuleChanges(changes: PricingRuleChange[]) {
  const current = await prisma.pricingRule.findMany({
    select: {
      id: true,
      serviceType: true,
      minQuantity: true,
      maxQuantity: true,
      pricePerUnit: true,
      basePrice: true,
      minimumNetPrice: true,
      isActive: true,
    },
  });
  const byId = new Map(current.map((rule) => [rule.id, rule]));
  const proposed: PricingRuleChange[] = current.filter((rule) => rule.isActive).map((rule) => ({ ...rule }));

  for (const change of changes) {
    const normalized = {
      id: change.id,
      serviceType: change.serviceType ?? ServiceType.FLYER_DISTRIBUTION,
      minQuantity: change.minQuantity,
      maxQuantity: change.maxQuantity,
      pricePerUnit: change.pricePerUnit,
      basePrice: change.basePrice,
      minimumNetPrice: change.minimumNetPrice,
      isActive: change.isActive,
    };
    const existing = change.id ? byId.get(change.id) : null;
    const next = existing ? proposed.filter((rule) => rule.id !== existing.id) : proposed;
    if (normalized.isActive) next.push(normalized);
    proposed.splice(0, proposed.length, ...next);
  }

  const grouped = new Map<ServiceType, PricingRuleChange[]>();
  for (const rule of proposed) {
    const list = grouped.get(rule.serviceType) ?? [];
    list.push(rule);
    grouped.set(rule.serviceType, list);
  }
  for (const [serviceType, rules] of grouped) {
    const error = activeRuleValidationMessage(rules);
    if (error) return error;
    const ordered = [...rules].sort((left, right) => left.minQuantity - right.minQuantity);
    if (serviceType === ServiceType.FLYER_DISTRIBUTION && ordered[0]?.minQuantity !== 1) {
      return "Die Flyer-Staffel muss bei 1 Flyer beginnen.";
    }
  }
  if (!grouped.get(ServiceType.FLYER_DISTRIBUTION)?.length) {
    return "Mindestens eine aktive Flyer-Preisregel ist erforderlich.";
  }
  return null;
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function withCurrentPricingSnapshot(input: {
  price: PriceCalculation;
  snapshot?: unknown;
  areaCalculationSnapshot?: unknown;
}) {
  const existing = jsonRecord(input.snapshot);
  const areaSnapshotValue = input.areaCalculationSnapshot ?? existing.areaCalculationSnapshot;
  const areaSnapshot = areaSnapshotValue && typeof areaSnapshotValue === "object" && !Array.isArray(areaSnapshotValue)
    ? {
        ...areaSnapshotValue as Record<string, unknown>,
        pricingVersion: input.price.snapshot.pricingVersion,
        pricingRuleSignature: input.price.snapshot.pricingRuleSignature,
        pricingNetPrice: input.price.net.toString(),
        pricingVatRate: input.price.snapshot.vatRate,
        pricingGrossPrice: input.price.gross.toString(),
        pricingCalculatedAt: input.price.snapshot.calculatedAt,
      }
    : null;

  return {
    ...existing,
    ...input.price.snapshot,
    areaCalculationSnapshot: areaSnapshot,
  } as Prisma.InputJsonValue;
}

export async function syncOpenOrderPrices() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...OPEN_PRICE_ORDER_STATUSES] },
      payments: { none: { status: { in: [...SETTLED_PAYMENT_STATUSES] } } },
    },
    select: {
      id: true,
      orderNumber: true,
      tenantId: true,
      customerId: true,
      serviceType: true,
      flyerQuantity: true,
      manualPriceOverride: true,
      calculatedNetPrice: true,
      calculatedVat: true,
      calculatedGrossPrice: true,
      priceRuleSnapshot: true,
      customer: { select: { userId: true } },
      payments: {
        where: { status: { in: OPEN_CHECKOUT_PAYMENT_STATUSES } },
        select: { id: true, status: true, stripeCheckoutSessionId: true },
      },
    },
  });

  let updatedCount = 0;
  let invalidatedCheckoutCount = 0;
  for (const order of orders) {
    const configuredPrice = await calculateOrderPrice({ serviceType: order.serviceType, flyerQuantity: order.flyerQuantity });
    const existingSnapshot = order.priceRuleSnapshot && typeof order.priceRuleSnapshot === "object" && !Array.isArray(order.priceRuleSnapshot)
      ? order.priceRuleSnapshot as Record<string, unknown>
      : {};
    const manualOverride = order.manualPriceOverride;
    const manualPrice = manualOverride === null
      ? null
      : calculatePriceFromNet(manualOverride as Prisma.Decimal, configuredPrice.snapshot.vatRate);
    const price = manualPrice
      ? {
          ...configuredPrice,
          net: manualPrice.net,
          vat: manualPrice.vat,
          gross: manualPrice.gross,
          snapshot: {
            ...configuredPrice.snapshot,
            manualPriceOverride: (manualOverride as Prisma.Decimal).toString(),
            manualVatRate: configuredPrice.snapshot.vatRate,
            manualVat: manualPrice.vat.toString(),
            manualCalculatedGross: manualPrice.gross.toString(),
            calculatedNet: manualPrice.net.toString(),
            calculatedGross: manualPrice.gross.toString(),
          },
        }
      : configuredPrice;
    const amountChanged = !order.calculatedNetPrice.equals(price.net) || !order.calculatedVat.equals(price.vat) || !order.calculatedGrossPrice.equals(price.gross);
    const snapshotChanged = manualOverride === null
      ? existingSnapshot.pricingRuleSignature !== price.snapshot.pricingRuleSignature
      : existingSnapshot.manualVatRate !== configuredPrice.snapshot.vatRate || existingSnapshot.manualCalculatedGross !== manualPrice?.gross.toString();
    if (!amountChanged && !snapshotChanged) continue;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        calculatedNetPrice: price.net,
        calculatedVat: price.vat,
        calculatedGrossPrice: price.gross,
        priceRuleSnapshot: withCurrentPricingSnapshot({
          price,
          snapshot: existingSnapshot,
        }),
      },
    });

    const invalidatedPayments = [];
    for (const payment of order.payments) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      await prisma.paymentStatusHistory.create({
        data: {
          paymentId: payment.id,
          fromStatus: payment.status,
          toStatus: "CANCELLED",
          reason: "Preisregel wurde geändert. Offener Checkout wurde aus Sicherheitsgründen ungültig gemacht.",
        },
      });
      const externalSessionExpired = await expireExternalCheckoutSession(payment.stripeCheckoutSessionId);
      invalidatedPayments.push({ id: payment.id, externalSessionExpired });
      invalidatedCheckoutCount += 1;
    }

    await createAuditLog({
      userId: order.customer.userId,
      tenantId: order.tenantId,
      action: amountChanged ? "order.price_updated_from_pricing_settings" : "order.price_snapshot_updated_from_pricing_settings",
      entityType: "Order",
      entityId: order.id,
      oldValues: {
        calculatedNetPrice: order.calculatedNetPrice.toString(),
        calculatedVat: order.calculatedVat.toString(),
        calculatedGrossPrice: order.calculatedGrossPrice.toString(),
        pricingRuleSignature: existingSnapshot.pricingRuleSignature ?? null,
      },
      newValues: {
        calculatedNetPrice: price.net.toString(),
        calculatedVat: price.vat.toString(),
        calculatedGrossPrice: price.gross.toString(),
        pricingVersion: price.snapshot.pricingVersion,
        pricingRuleSignature: price.snapshot.pricingRuleSignature,
        invalidatedPayments,
      },
    });
    await createNotification({
      userId: order.customer.userId,
      type: "ORDER_PRICE_UPDATED",
      title: "Preisvorschau aktualisiert",
      message: order.payments.length
        ? `Die Preisvorschau fuer ${order.orderNumber} wurde aktualisiert. Bitte starte die Zahlung mit dem neuen Betrag erneut.`
        : amountChanged
          ? `Die Preisvorschau fuer ${order.orderNumber} wurde nach einer Aktualisierung der Preisregeln neu berechnet.`
          : `Die Preisgrundlage fuer ${order.orderNumber} wurde nach einer Aktualisierung der Preisregeln geprueft.`,
      data: {
        orderNumber: order.orderNumber,
        orderId: order.id,
        paymentAmount: price.gross.toString(),
        pricingVersion: price.snapshot.pricingVersion,
        pricingRuleSignature: price.snapshot.pricingRuleSignature,
        paymentInvalidated: order.payments.length > 0 ? "true" : "false",
      },
    });
    updatedCount += 1;
  }
  return { updatedCount, invalidatedCheckoutCount };
}

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
  const pricingRuleSignature = createHash("sha256")
    .update(JSON.stringify({
      pricingVersion: PREMIUM_PRICING_VERSION,
      vatRate: vatRate.toString(),
      rules: rules.map((candidate) => ({
        id: candidate.id,
        minQuantity: candidate.minQuantity,
        maxQuantity: candidate.maxQuantity,
        pricePerUnit: candidate.pricePerUnit.toString(),
        basePrice: candidate.basePrice.toString(),
        minimumNetPrice: candidate.minimumNetPrice.toString(),
      })),
    }))
    .digest("hex")
    .slice(0, 16);

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
      pricingRuleSignature,
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
