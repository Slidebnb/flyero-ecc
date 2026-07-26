import { Prisma } from "@prisma/client";
import type Stripe from "stripe";

export type AppliedStripePromotion = {
  provider: "stripe";
  type: "PROMOTION_CODE";
  stripePromotionCodeId: string | null;
  stripeCouponId: string | null;
  baseNet: string;
  baseVat: string;
  baseGross: string;
  discountGross: string;
  finalNet: string;
  finalVat: string;
  finalGross: string;
  currency: string;
  checkoutSessionId: string;
  appliedAt: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function decimal(value: Prisma.Decimal | string | number) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function optionalId(value: unknown) {
  const candidate = record(value);
  return typeof value === "string" ? value : typeof candidate.id === "string" ? candidate.id : null;
}

export function buildAppliedStripePromotion(input: {
  session: Stripe.Checkout.Session;
  baseNet: Prisma.Decimal | string | number;
  baseVat: Prisma.Decimal | string | number;
  baseGross: Prisma.Decimal | string | number;
  vatRate: Prisma.Decimal | string | number;
}) {
  const discountCents = input.session.total_details?.amount_discount ?? 0;
  if (!Number.isFinite(discountCents) || discountCents <= 0) return null;
  if (input.session.amount_total === null || input.session.amount_total === undefined) return null;

  const finalGross = decimal(input.session.amount_total).div(100).toDecimalPlaces(2);
  const finalNet = finalGross.div(decimal(1).plus(decimal(input.vatRate))).toDecimalPlaces(2);
  const finalVat = finalGross.minus(finalNet).toDecimalPlaces(2);
  const discounts = (input.session as unknown as { discounts?: unknown[] }).discounts;
  const firstDiscount = Array.isArray(discounts) ? discounts[0] : null;
  const discountRecord = record(firstDiscount);

  return {
    provider: "stripe",
    type: "PROMOTION_CODE",
    stripePromotionCodeId: optionalId(discountRecord.promotion_code),
    stripeCouponId: optionalId(discountRecord.coupon),
    baseNet: decimal(input.baseNet).toString(),
    baseVat: decimal(input.baseVat).toString(),
    baseGross: decimal(input.baseGross).toString(),
    discountGross: decimal(discountCents).div(100).toDecimalPlaces(2).toString(),
    finalNet: finalNet.toString(),
    finalVat: finalVat.toString(),
    finalGross: finalGross.toString(),
    currency: (input.session.currency ?? "eur").toUpperCase(),
    checkoutSessionId: input.session.id,
    appliedAt: new Date().toISOString(),
  } satisfies AppliedStripePromotion;
}

export function readAppliedStripePromotion(value: unknown): AppliedStripePromotion | null {
  const promotion = record(record(value).promotion);
  if (promotion.provider !== "stripe" || promotion.type !== "PROMOTION_CODE") return null;
  const required = ["baseNet", "baseVat", "baseGross", "discountGross", "finalNet", "finalVat", "finalGross", "currency", "checkoutSessionId", "appliedAt"];
  if (required.some((key) => typeof promotion[key] !== "string")) return null;
  return promotion as unknown as AppliedStripePromotion;
}
