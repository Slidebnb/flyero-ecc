import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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
import { notifyAdmins } from "@/lib/notifications";
import { warehouseSourceWhere } from "@/lib/warehouse";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getCustomerOrder(userId: string, tenantId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, tenantId, customer: { userId, tenantId } },
    include: {
      statusEvents: { orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, status: true, stripeCheckoutSessionId: true } },
    },
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

    const paid = order.payments.some((payment) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status));
    if (paid) {
      return Response.json({ ok: false, code: "PAID_ORDER_REQUIRES_ADMIN_CHANGE", error: "Diese Kampagne wurde bereits bezahlt. Änderungen an Gebiet, Menge oder Leistung müssen durch das FLYERO-Team geprüft werden." }, { status: 409 });
    }
    if (order.status !== "DRAFT" && order.status !== "WAITING_FOR_CUSTOMER") {
      return errorResponse("Dieser Auftrag kann vom Kunden nicht mehr bearbeitet werden.", 409);
    }

    const parsed = orderUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const data = parsed.data;
    if (data.flyerSource === "PRINT_SERVICE") {
      return Response.json({
        ok: false,
        code: "PRINT_SERVICE_CONTACT_ONLY",
        error: "FLYERO bietet im Online-Auftrag keinen Druckservice an. Bitte besprich den Druck separat über den Kontakt zu uns.",
      }, { status: 422 });
    }
    const selectedWarehouse = data.warehouseId
      ? await prisma.warehouse.findFirst({
          where: { id: data.warehouseId, isActive: true, ...warehouseSourceWhere() },
          select: { id: true, name: true },
        })
      : null;
    if (data.warehouseId && !selectedWarehouse) {
      return errorResponse("Das ausgewählte Empfangslager ist nicht verfügbar. Bitte wähle ein anderes Lager.", 422);
    }
    const isCustomerCorrection = order.status === "WAITING_FOR_CUSTOMER";
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
    let distributionAreaId = isCustomerCorrection ? null : data.distributionAreaId ?? order.distributionAreaId ?? null;
    const customer = await prisma.customerProfile.findUnique({
      where: { userId: session.id, tenantId: session.tenantId },
      select: { id: true },
    });

    if (!distributionAreaId && customer && !isCustomerCorrection) {
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
    const nextStatus = isCustomerCorrection ? "UNDER_REVIEW" : data.status ?? "PAYMENT_PENDING";

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.order.update({
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
        targetAreaGeoJson: isCustomerCorrection ? targetAreaGeoJson ?? Prisma.JsonNull : targetAreaGeoJson ?? undefined,
        estimatedHouseholds: intelligence.metrics.households ?? null,
        estimatedFlyers: data.flyerQuantity,
        estimatedDistanceMeters: intelligence.metrics.routeDistanceMeters ?? null,
        coverageAreaSqm: intelligence.metrics.coverageAreaSqm ? intelligence.metrics.coverageAreaSqm : null,
        flyerQuantity: data.flyerQuantity,
        customerOwnFlyers: data.flyerSource === "CUSTOMER_OWN",
        needsPrintService: data.flyerSource === "PRINT_SERVICE",
        ...(selectedWarehouse ? {
          assignedWarehouseId: selectedWarehouse.id,
          warehouseAssignedAt: new Date(),
          warehouseAssignmentReason: "Vom Kunden ausgewähltes Empfangslager für eigene Flyer.",
        } : {}),
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
      if (isCustomerCorrection) {
        const openPayments = await tx.payment.findMany({
          where: { orderId: id, status: { in: ["CREATED", "CHECKOUT_CREATED", "PENDING"] } },
          select: { id: true, status: true },
        });
        if (openPayments.length) {
          await tx.payment.updateMany({
            where: { id: { in: openPayments.map((payment) => payment.id) } },
            data: { status: "CANCELLED", cancelledAt: new Date() },
          });
          await tx.paymentStatusHistory.createMany({
            data: openPayments.map((payment) => ({
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: "CANCELLED" as const,
              reason: "Kundenkorrektur hat den bisherigen Zahlungslink ungueltig gemacht.",
            })),
          });
        }
        await tx.orderDistributionSegment.deleteMany({ where: { orderId: id } });
        if (areaSelection) {
          await tx.orderDistributionSegment.createMany({
            data: areaSelection.segments.map((segment, index) => {
              const intelligenceSegment = intelligence.metrics.segments?.[index];
              const warehouseMatch = intelligence.metrics.warehouseMatches?.[index];
              return {
                orderId: id,
                sortOrder: segment.sortOrder,
                name: segment.name,
                city: segment.city,
                postalCode: segment.postalCode,
                district: segment.district,
                country: segment.country,
                geometryGeoJson: segment.geometryGeoJson as Prisma.InputJsonValue,
                centerLat: segment.centerLat,
                centerLng: segment.centerLng,
                areaSqm: new Prisma.Decimal(segment.areaSqm),
                estimatedHouseholds: intelligenceSegment?.households ?? null,
                flyerQuantity: segment.flyerQuantity,
                dataSource: intelligenceSegment?.householdCountSource ?? null,
                dataSourceType: "ESTIMATED" as const,
                confidence: intelligenceSegment?.confidence === "high"
                  ? new Prisma.Decimal("1")
                  : intelligenceSegment?.confidence === "medium" ? new Prisma.Decimal("0.6") : new Prisma.Decimal("0.3"),
                warehouseMatchStatus: warehouseMatch?.matchedRegion ? "MATCHED" : "MANUAL_REVIEW",
                warehouseAssignmentReason: warehouseMatch?.reason ?? null,
                assignedWarehouseId: warehouseMatch?.matchedRegion ? warehouseMatch.warehouse?.id ?? null : null,
                distributionAreaId: null,
                notes: segment.notes,
              };
            }),
          });
        }
      }
      return changed;
    });

    if (order.status !== updated.status) {
      await createOrderStatusEvent({
        orderId: updated.id,
        fromStatus: order.status,
        toStatus: updated.status,
        changedBy: session.id,
      });
    }

    if (isCustomerCorrection) {
      await createAuditLog({
        userId: session.id,
        action: "order.customer_correction_submitted",
        entityType: "Order",
        entityId: updated.id,
        oldValues: { status: order.status, distributionAreaId: order.distributionAreaId },
        newValues: { status: updated.status, distributionAreaId: null, segmentCount: areaSelection?.segments.length ?? 0 },
        tenantId: session.tenantId,
      });
      await notifyAdmins({
        type: "ORDER_CORRECTION_SUBMITTED",
        title: "Kundenkorrektur eingegangen",
        message: `${updated.orderNumber}: Der Kunde hat Gebiet oder Auftragsdaten korrigiert. Neue Prüfung erforderlich.`,
        data: { orderId: updated.id },
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
    if (distributionAreaId && !isCustomerCorrection) {
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

    const settledPayment = order.payments.some((payment) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status));
    if (settledPayment) {
      return errorResponse("Bezahlte Kampagnen können nicht gelöscht werden.", 409);
    }

    if (!["DRAFT", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(order.status)) {
      return errorResponse("Diese Kampagne kann nicht mehr gelöscht werden.", 409);
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
