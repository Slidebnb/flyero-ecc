import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";

function boundedInteger(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.round(parsed), maximum) : null;
}

const PUBLIC_EVENT_TYPES = new Set([
  "PUBLIC_PLANNER_STARTED",
  "PUBLIC_SEARCH_SUBMITTED",
  "PUBLIC_AUTOCOMPLETE_SELECTED",
  "PUBLIC_INITIAL_GEOCODE_STARTED",
  "PUBLIC_INITIAL_GEOCODE_RESOLVED",
  "PUBLIC_INITIAL_GEOCODE_FAILED",
  "PUBLIC_LOCATION_SEARCH_STARTED",
  "PUBLIC_GEOCODE_POSTAL_MISMATCH",
  "PUBLIC_STALE_DRAFT_DISCARDED",
  "PUBLIC_LOCATION_REPLACED",
  "PUBLIC_LOCATION_FAILED",
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
  "PAYMENT_RETURNED_SUCCESS",
  "PAYMENT_RETURNED_CANCELLED",
  "INQUIRY_SUBMITTED",
  "PLANNER_ABANDONED",
  "WIZARD_INTERACTION",
]);

const publicExperienceSchema = z.object({
  eventType: z.string().trim().max(50).optional(),
  city: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(10).optional(),
  areaName: z.string().trim().max(120).optional(),
  durationMs: z.coerce.number().int().nonnegative().max(86_400_000).optional(),
  clickCount: z.coerce.number().int().nonnegative().max(10_000).optional(),
  fieldCount: z.coerce.number().int().nonnegative().max(1_000).optional(),
  usedAutocomplete: z.boolean().optional(),
  usedSavedArea: z.boolean().optional(),
  requestId: z.string().trim().max(120).optional(),
  polygonPoints: z.coerce.number().int().nonnegative().max(500).optional(),
  households: z.coerce.number().int().nonnegative().max(10_000_000).optional(),
  flyerQuantity: z.coerce.number().int().nonnegative().max(1_000_000).optional(),
  coverageAreaSqm: z.coerce.number().nonnegative().max(100_000_000).optional(),
  routeDistanceMeters: z.coerce.number().int().nonnegative().max(100_000_000).optional(),
  routeDurationMinutes: z.coerce.number().int().nonnegative().max(10_000).optional(),
});

function safeDecimal(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? new Prisma.Decimal(parsed) : null;
}

export async function POST(request: NextRequest) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-experience");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const parsed = publicExperienceSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse("Ungültige Planungsdaten.", 400);
    const body = parsed.data;
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
        metadata: { plannerMode: "public_quote", requestId: body.requestId ?? null },
      },
    });
    return Response.json({ ok: true, data: { id: event.id } }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
