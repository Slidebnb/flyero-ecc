import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse } from "@/lib/request";

function boundedInteger(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.round(parsed), maximum) : null;
}

const PUBLIC_EVENT_TYPES = new Set([
  "PUBLIC_PLANNER_STARTED",
  "LOCATION_SEARCH_COMPLETED",
  "AREA_SELECTED",
  "AREA_CHANGED",
  "FLYER_STEP_COMPLETED",
  "SCHEDULE_STEP_COMPLETED",
  "QUOTE_VIEWED",
  "AUTH_GATE_VIEWED",
  "REGISTRATION_STARTED",
  "REGISTRATION_COMPLETED",
  "LOGIN_COMPLETED",
  "DRAFT_RESTORED",
  "CHECKOUT_STARTED",
  "PAYMENT_RETURNED_SUCCESS",
  "PAYMENT_RETURNED_CANCELLED",
  "INQUIRY_SUBMITTED",
  "PLANNER_ABANDONED",
  "WIZARD_INTERACTION",
]);

function safeDecimal(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? new Prisma.Decimal(parsed) : null;
}

export async function POST(request: NextRequest) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const body = await readBody(request) as Record<string, unknown>;
    const requestedEventType = typeof body.eventType === "string" ? body.eventType : "WIZARD_INTERACTION";
    const eventType = PUBLIC_EVENT_TYPES.has(requestedEventType) ? requestedEventType : "WIZARD_INTERACTION";
    const event = await prisma.orderExperienceEvent.create({
      data: {
        eventType,
        source: "public-order-planner",
        city: typeof body.city === "string" ? body.city.slice(0, 80) : null,
        postalCode: typeof body.postalCode === "string" ? body.postalCode.slice(0, 10) : null,
        areaName: typeof body.areaName === "string" ? body.areaName.slice(0, 120) : null,
        durationMs: boundedInteger(body.durationMs, 86_400_000),
        clickCount: boundedInteger(body.clickCount, 10_000),
        fieldCount: boundedInteger(body.fieldCount, 1_000),
        usedAutocomplete: Boolean(body.usedAutocomplete),
        usedSavedArea: Boolean(body.usedSavedArea),
        polygonPoints: boundedInteger(body.polygonPoints, 500),
        households: boundedInteger(body.households, 10_000_000),
        flyerQuantity: boundedInteger(body.flyerQuantity, 1_000_000),
        coverageAreaSqm: safeDecimal(body.coverageAreaSqm, 100_000_000),
        routeDistanceMeters: boundedInteger(body.routeDistanceMeters, 100_000_000),
        routeDurationMinutes: boundedInteger(body.routeDurationMinutes, 10_000),
        metadata: { plannerMode: "public_quote" },
      },
    });
    return Response.json({ ok: true, data: { id: event.id } }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
