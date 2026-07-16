import { AreaDifficulty, Prisma, ServiceType } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { calculateOrderPrice, PricingRuleChange, PricingRuleLike, validatePricingRuleChanges } from "@/lib/pricing";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { weightClassFromGrams } from "@/lib/servicePricing";

const MAX_QUANTITY = 10_000_000;

function decimal(value: unknown, field: string) {
  try {
    const result = new Prisma.Decimal(String(value));
    if (result.isNegative() || !result.isFinite()) throw new Error();
    return result;
  } catch {
    throw new Error(`${field} ist ungueltig.`);
  }
}

function normalizeRules(value: unknown, serviceType: ServiceType): { changes: PricingRuleChange[]; rules: PricingRuleLike[] } | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) throw new Error("Mindestens eine Preisregel ist erforderlich.");

  const changes: PricingRuleChange[] = [];
  const rules: PricingRuleLike[] = [];
  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Eine Preisregel ist ungueltig.");
    const rule = raw as Record<string, unknown>;
    const ruleServiceType = String(rule.serviceType ?? serviceType) as ServiceType;
    if (ruleServiceType !== serviceType) throw new Error("Die Preisregeln muessen zur ausgewaehlten Leistung gehoeren.");
    const minQuantity = Number(rule.minQuantity);
    const maxQuantity = rule.maxQuantity === null || rule.maxQuantity === "" || rule.maxQuantity === undefined ? null : Number(rule.maxQuantity);
    if (!Number.isInteger(minQuantity) || minQuantity < 1 || (maxQuantity !== null && (!Number.isInteger(maxQuantity) || maxQuantity < minQuantity))) {
      throw new Error("Mengenbereich einer Preisregel ist ungueltig.");
    }
    const isActive = rule.isActive !== false;
    const id = String(rule.id ?? `preview-${index}`);
    const pricePerUnit = decimal(rule.pricePerUnit ?? "0", "Preis je Einheit");
    const basePrice = decimal(rule.basePrice ?? "0", "Basispreis");
    const minimumNetPrice = decimal(rule.minimumNetPrice ?? "0", "Mindestpreis");
    changes.push({ id, serviceType: ruleServiceType, minQuantity, maxQuantity, pricePerUnit, basePrice, minimumNetPrice, isActive });
    if (isActive) rules.push({ id, minQuantity, maxQuantity, pricePerUnit, basePrice, minimumNetPrice, pricingVersion: String(rule.pricingVersion ?? "service-pricing-preview"), configurationVersion: String(rule.configurationVersion ?? "pricing-config-preview") });
  });
  return { changes, rules };
}

export async function POST(request: Request) {
  try {
    await requirePermission(Permission.PRICING_MANAGE);
    const body = await readBody(request as never) as Record<string, unknown>;
    const serviceTypeValue = String(body.serviceType ?? "");
    if (!Object.values(ServiceType).includes(serviceTypeValue as ServiceType)) return errorResponse("Leistungstyp ist ungueltig.", 422);
    const serviceType = serviceTypeValue as ServiceType;
    const flyerQuantity = Number(body.quantity ?? body.flyerQuantity);
    if (!Number.isInteger(flyerQuantity) || flyerQuantity < 1 || flyerQuantity > MAX_QUANTITY) return errorResponse("Die Menge muss zwischen 1 und 10.000.000 liegen.", 422);

    const weightInGrams = body.weightInGrams === null || body.weightInGrams === undefined || body.weightInGrams === "" ? null : Number(body.weightInGrams);
    if (weightInGrams !== null && (!Number.isInteger(weightInGrams) || weightInGrams < 0 || weightInGrams > 10_000)) return errorResponse("Das Gewicht muss zwischen 0 und 10.000 Gramm liegen.", 422);
    const areaDifficultyValue = String(body.areaDifficulty ?? AreaDifficulty.NORMAL);
    if (!Object.values(AreaDifficulty).includes(areaDifficultyValue as AreaDifficulty)) return errorResponse("Gebietsart ist ungueltig.", 422);

    const normalized = normalizeRules(body.rules, serviceType);
    if (normalized) {
      const validationError = await validatePricingRuleChanges(normalized.changes);
      if (validationError) return errorResponse(validationError, 422);
      if (normalized.rules.length === 0) return errorResponse("Mindestens eine aktive Preisregel ist erforderlich.", 422);
    }

    const price = await calculateOrderPrice({
      serviceType,
      flyerQuantity,
      weightInGrams,
      areaDifficulty: areaDifficultyValue as AreaDifficulty,
      express: Boolean(body.express),
      expressWithin72Hours: Boolean(body.expressWithin72Hours),
      weekendOrHoliday: Boolean(body.weekendOrHoliday),
      additionalAreaCount: Number(body.additionalAreaCount ?? 1),
      pickupRequired: Boolean(body.pickupRequired),
      storageUnits: Number(body.storageUnits ?? 0),
      pricingRulesOverride: normalized?.rules,
    });

    return successResponse({
      serviceType,
      flyerQuantity,
      weightClass: weightClassFromGrams(weightInGrams),
      areaDifficulty: areaDifficultyValue,
      calculatedNet: price.net.toString(),
      vatAmount: price.vat.toString(),
      calculatedGross: price.gross.toString(),
      checkoutAllowed: price.snapshot.checkoutAllowed,
      manualReviewRequired: price.snapshot.manualReviewRequired,
      pricingVersion: price.snapshot.pricingVersion,
      configurationVersion: price.snapshot.configurationVersion,
      ruleIds: price.snapshot.ruleIds,
      boundaryCheck: "passed",
      snapshot: price.snapshot,
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
