import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { createDistributionArea, linkAreaReferenceToOrder } from "@/lib/areas";
import { createOrderStatusEvent } from "@/lib/orders";
import { calculateOrderPrice, withCurrentPricingSnapshot } from "@/lib/pricing";
import { getOrderIntelligence } from "@/lib/smartMaps";
import { aggregateOrderAreaSegments } from "@/lib/orderSegments";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { orderUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getCustomerOrder(userId: string, tenantId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, tenantId, customer: { userId, tenantId } },
    include: { statusEvents: { orderBy: { createdAt: "asc" } } },
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const order = await getCustomerOrder(session.id, session.tenantId, id);

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    return Response.json({ ok: true, data: order });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const order = await getCustomerOrder(session.id, session.tenantId, id);

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    if (order.status !== "DRAFT" && order.status !== "WAITING_FOR_CUSTOMER") {
      return errorResponse("Dieser Auftrag kann vom Kunden nicht mehr bearbeitet werden.", 409);
    }

    const parsed = orderUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const data = parsed.data;
    let areaSelection = null;
    try {
      areaSelection = data.areaSegments ? aggregateOrderAreaSegments(data.areaSegments) : null;
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Das Verteilgebiet konnte nicht verarbeitet werden.", 400);
    }
    const targetAreaGeoJson = areaSelection?.targetAreaGeoJson ?? data.targetAreaGeoJson;
    const primarySegment = areaSelection?.primarySegment ?? null;
    const intelligence = await getOrderIntelligence({
      tenantId: session.tenantId,
      city: primarySegment?.city ?? data.city,
      postalCode: primarySegment?.postalCode ?? data.postalCode,
      street: data.street,
      houseNumber: data.houseNumber,
      distributionAreaId: data.distributionAreaId,
      flyerQuantity: data.flyerQuantity,
      targetAreaGeoJson,
      segments: data.areaSegments,
      coverageAreaSqm: data.coverageAreaSqm,
      flyerSource: data.flyerSource,
      productFormat: data.productFormat,
      printDataStatus: data.printDataStatus,
      preferredStartDate: data.preferredStartDate,
      preferredEndDate: data.preferredEndDate,
      includeOperationalData: true,
    });
    if (data.quoteFingerprint !== intelligence.metrics.fingerprint) {
      return Response.json({
        ok: false,
        code: "PLANNING_QUOTE_CHANGED",
        error: "Die Preis- und Gebietsberechnung hat sich geändert. Bitte aktualisiere die Planung und bestätige sie erneut.",
        data: { quote: intelligence.metrics.quote },
      }, { status: 409 });
    }
    let distributionAreaId = data.distributionAreaId ?? order.distributionAreaId ?? null;
    const customer = await prisma.customerProfile.findUnique({
      where: { userId: session.id, tenantId: session.tenantId },
      select: { id: true },
    });

    if (!distributionAreaId && customer) {
      const area = await createDistributionArea({
        userId: session.id,
        customerId: customer.id,
        tenantId: session.tenantId,
        name: data.targetAreaName,
        type: data.areaType ?? (data.targetAreaGeoJson ? "POLYGON" : "POSTAL_CODE"),
        city: data.city,
        postalCode: data.postalCode,
        district: data.areaType === "DISTRICT" ? data.targetAreaName : null,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusMeters: data.radiusMeters,
        geoJson: targetAreaGeoJson,
        coverageAreaSqm: intelligence.metrics.coverageAreaSqm,
        estimatedHouseholds: intelligence.metrics.households,
        estimatedFlyers: data.flyerQuantity,
        estimatedDistanceMeters: intelligence.metrics.routeDistanceMeters,
        reusable: false,
      });
      distributionAreaId = area.id;
    }

    const price = await calculateOrderPrice({
      serviceType: data.serviceType,
      flyerQuantity: data.flyerQuantity,
    });
    const nextStatus = data.status ?? "PAYMENT_PENDING";

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: nextStatus,
        serviceType: data.serviceType,
        city: primarySegment?.city ?? data.city,
        postalCode: primarySegment?.postalCode ?? data.postalCode,
        targetAddress: {
          street: data.street ?? data.targetAreaName,
          houseNumber: data.houseNumber || null,
        postalCode: data.postalCode,
        city: data.city,
        country: "DE",
      },
        targetLat: data.centerLat ?? undefined,
        targetLng: data.centerLng ?? undefined,
        distributionAreaId,
        targetAreaName: data.targetAreaName,
        targetAreaGeoJson: targetAreaGeoJson ?? undefined,
        estimatedHouseholds: intelligence.metrics.households ?? null,
        estimatedFlyers: data.flyerQuantity,
        estimatedDistanceMeters: intelligence.metrics.routeDistanceMeters ?? null,
        coverageAreaSqm: intelligence.metrics.coverageAreaSqm ? intelligence.metrics.coverageAreaSqm : null,
        flyerQuantity: data.flyerQuantity,
        customerOwnFlyers: data.flyerSource === "CUSTOMER_OWN",
        needsPrintService: data.flyerSource === "PRINT_SERVICE",
        preferredStartDate: data.preferredStartDate,
        preferredEndDate: data.preferredEndDate,
        flexibleScheduling: data.flexibleScheduling,
        notes: data.notes || null,
        contactPerson: data.contactPerson || null,
        contactPhone: data.contactPhone || null,
        calculatedNetPrice: price.net,
        calculatedVat: price.vat,
        calculatedGrossPrice: price.gross,
        priceRuleSnapshot: withCurrentPricingSnapshot({
          price,
          areaCalculationSnapshot: {
            ...(data.areaCalculationSnapshot && typeof data.areaCalculationSnapshot === "object" && !Array.isArray(data.areaCalculationSnapshot) ? data.areaCalculationSnapshot : {}),
            ...intelligence.metrics,
            quote: intelligence.metrics.quote,
            planningInput: intelligence.metrics.quote?.input ?? null,
            quoteFingerprint: intelligence.metrics.fingerprint,
            polygonHash: intelligence.metrics.polygonHash,
            calculationVersion: intelligence.metrics.calculationVersion,
            productFormat: data.productFormat,
          },
          snapshot: {
            ...(order.priceRuleSnapshot && typeof order.priceRuleSnapshot === "object" && !Array.isArray(order.priceRuleSnapshot) ? order.priceRuleSnapshot : {}),
            productFormat: data.productFormat,
          },
        }),
      },
    });

    if (order.status !== updated.status) {
      await createOrderStatusEvent({
        orderId: updated.id,
        fromStatus: order.status,
        toStatus: updated.status,
        changedBy: session.id,
      });
    }

    await createAuditLog({
      userId: session.id,
      action: "order.updated",
      entityType: "Order",
      entityId: updated.id,
      oldValues: { status: order.status, flyerQuantity: order.flyerQuantity },
      newValues: { status: updated.status, flyerQuantity: updated.flyerQuantity },
      tenantId: session.tenantId,
    });
    if (distributionAreaId) {
      await linkAreaReferenceToOrder({ orderId: updated.id, areaId: distributionAreaId, userId: session.id });
    }

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/customer/orders/${updated.id}`, request.url), {
        status: 303,
      });
    }

    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const order = await getCustomerOrder(session.id, session.tenantId, id);

    if (!order) {
      return errorResponse("Auftrag wurde nicht gefunden.", 404);
    }

    if (order.status !== "DRAFT") {
      return errorResponse("Nur Entwürfe können gelöscht werden.", 409);
    }

    await prisma.order.delete({ where: { id } });
    await createAuditLog({
      userId: session.id,
      action: "order.cancelled",
      entityType: "Order",
      entityId: id,
      oldValues: { status: order.status },
      newValues: { deleted: true },
      tenantId: session.tenantId,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
