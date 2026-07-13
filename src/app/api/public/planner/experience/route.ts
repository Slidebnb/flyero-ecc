import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { enforcePublicRateLimit, publicRateLimitResponse } from "@/lib/publicAbuseProtection";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse } from "@/lib/request";

function boundedInteger(value: unknown, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.round(parsed), maximum) : null;
}

export async function POST(request: NextRequest) {
  try {
    const abuseDecision = await enforcePublicRateLimit(request, "public-planner");
    if (!abuseDecision.allowed) return publicRateLimitResponse(abuseDecision);
    const body = await readBody(request) as Record<string, unknown>;
    const event = await prisma.orderExperienceEvent.create({
      data: {
        eventType: typeof body.eventType === "string" ? body.eventType.slice(0, 60) : "WIZARD_INTERACTION",
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
        coverageAreaSqm: body.coverageAreaSqm ? new Prisma.Decimal(String(body.coverageAreaSqm)) : null,
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
