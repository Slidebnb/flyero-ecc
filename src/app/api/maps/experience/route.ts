import { Prisma, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse } from "@/lib/request";

function positiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const body = await readBody(request) as Record<string, unknown>;
    const customer = session.role === UserRole.CUSTOMER
      ? await prisma.customerProfile.findUnique({ where: { userId: session.id }, select: { id: true } })
      : null;
    const event = await prisma.orderExperienceEvent.create({
      data: {
        orderId: typeof body.orderId === "string" && body.orderId ? body.orderId : null,
        customerId: customer?.id ?? (typeof body.customerId === "string" ? body.customerId : null),
        userId: session.id,
        eventType: typeof body.eventType === "string" ? body.eventType : "WIZARD_INTERACTION",
        source: typeof body.source === "string" ? body.source : "order-wizard",
        city: typeof body.city === "string" ? body.city : null,
        postalCode: typeof body.postalCode === "string" ? body.postalCode : null,
        areaName: typeof body.areaName === "string" ? body.areaName : null,
        areaType: typeof body.areaType === "string" ? body.areaType as never : null,
        durationMs: positiveInt(body.durationMs),
        clickCount: positiveInt(body.clickCount),
        fieldCount: positiveInt(body.fieldCount),
        usedAutocomplete: Boolean(body.usedAutocomplete),
        usedSavedArea: Boolean(body.usedSavedArea),
        polygonPoints: positiveInt(body.polygonPoints),
        households: positiveInt(body.households),
        flyerQuantity: positiveInt(body.flyerQuantity),
        coverageAreaSqm: body.coverageAreaSqm ? new Prisma.Decimal(String(body.coverageAreaSqm)) : null,
        routeDistanceMeters: positiveInt(body.routeDistanceMeters),
        routeDurationMinutes: positiveInt(body.routeDurationMinutes),
        metadata: body.metadata ? body.metadata as Prisma.InputJsonValue : undefined,
      },
    });
    return Response.json({ ok: true, data: { id: event.id } }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
