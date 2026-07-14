import { OrderStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createAuditLog } from "@/lib/audit";
import { createDistributionArea, linkAreaReferenceToOrder } from "@/lib/areas";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { assignWarehouseForOrder } from "@/lib/logistics";
import { generateOrderNumber, createOrderStatusEvent } from "@/lib/orders";
import { calculateOrderPrice, withCurrentPricingSnapshot } from "@/lib/pricing";
import { getOrderIntelligence } from "@/lib/smartMaps";
import { aggregateOrderAreaSegments } from "@/lib/orderSegments";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { orderCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const customer = await prisma.customerProfile.findFirst({
      where: { userId: session.id, tenantId: session.tenantId },
      select: { id: true, companyName: true },
    });

    if (!customer) {
      return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    }

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        city: true,
        targetAreaName: true,
        flyerQuantity: true,
        calculatedGrossPrice: true,
        manualPriceOverride: true,
        preferredStartDate: true,
        createdAt: true,
      },
    });

    return Response.json({ ok: true, data: orders });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const parsed = orderCreateSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const customer = await prisma.customerProfile.findFirst({
      where: { userId: session.id, tenantId: session.tenantId },
      select: { id: true, companyName: true },
    });

    if (!customer) {
      return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    }

    const data = parsed.data;
    let areaSelection = null;
    try {
      areaSelection = data.areaSegments ? aggregateOrderAreaSegments(data.areaSegments) : null;
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Das Verteilgebiet konnte nicht verarbeitet werden.", 400);
    }
    const primarySegment = areaSelection?.primarySegment ?? null;
    const targetAreaGeoJson = areaSelection?.targetAreaGeoJson ?? data.targetAreaGeoJson;
    const orderCity = primarySegment?.city ?? data.city;
    const orderPostalCode = primarySegment?.postalCode ?? data.postalCode;
    const intelligence = await getOrderIntelligence({
      tenantId: session.tenantId,
      city: orderCity,
      postalCode: orderPostalCode,
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
    const serverCoverageAreaSqm = intelligence.metrics.coverageAreaSqm ?? areaSelection?.totalAreaSqm ?? null;
    const serverHouseholds = intelligence.metrics.households ?? null;
    const serverDistanceMeters = intelligence.metrics.routeDistanceMeters ?? null;
    const serverAreaSnapshot = {
      ...(data.areaCalculationSnapshot && typeof data.areaCalculationSnapshot === "object" && !Array.isArray(data.areaCalculationSnapshot)
        ? data.areaCalculationSnapshot as Record<string, unknown>
        : {}),
      ...(intelligence.metrics ?? {}),
      quote: intelligence.metrics.quote,
      planningInput: intelligence.metrics.quote?.input ?? null,
      quoteFingerprint: intelligence.metrics.fingerprint,
      polygonHash: intelligence.metrics.polygonHash,
      segments: intelligence.metrics.segments ?? areaSelection?.segments ?? [],
      calculationVersion: intelligence.metrics.calculationVersion ?? "order-area-v2-multi-segment",
    };
    const requiresManualReview = Boolean(intelligence.metrics.needsManualReview);
    let distributionAreaId = areaSelection ? null : data.distributionAreaId ?? null;

    if (!distributionAreaId) {
      const area = await createDistributionArea({
        userId: session.id,
        customerId: customer.id,
        tenantId: session.tenantId,
        name: data.targetAreaName,
        type: data.areaType ?? (targetAreaGeoJson ? "POLYGON" : "POSTAL_CODE"),
        city: orderCity,
        postalCode: orderPostalCode,
        district: data.areaType === "DISTRICT" ? data.targetAreaName : null,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusMeters: data.radiusMeters,
        geoJson: targetAreaGeoJson,
        coverageAreaSqm: serverCoverageAreaSqm,
        estimatedHouseholds: serverHouseholds,
        estimatedFlyers: data.flyerQuantity,
        estimatedDistanceMeters: serverDistanceMeters,
        reusable: false,
      });
      distributionAreaId = area.id;
    }

    const price = await calculateOrderPrice({
      serviceType: data.serviceType,
      flyerQuantity: data.flyerQuantity,
    });
    const status: OrderStatus = data.completionPath === "direct_payment"
      ? requiresManualReview ? "UNDER_REVIEW" : "PAYMENT_PENDING"
      : "SUBMITTED";
    const customerNotePrefix = data.completionPath === "direct_payment"
      ? "Direkt online buchen und bezahlen."
      : data.completionPath === "document_email"
        ? "Klassische Anfrage per Formular oder E-Mail."
        : "Unverbindliche Anfrage ohne Zahlung.";
    const printDataLabel = data.printDataStatus === "UPLOADED"
      ? "Druckdaten hochgeladen"
      : data.printDataStatus === "PRINT_REQUESTED"
        ? "Druck über FLYERO angefragt"
        : "Druckdaten werden später bereitgestellt";

    let order: Awaited<ReturnType<typeof prisma.order.create>> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await prisma.$transaction(async (tx) => tx.order.create({
          data: {
            orderNumber: await generateOrderNumber(),
            customerId: customer.id,
            tenantId: session.tenantId,
            status,
            serviceType: data.serviceType,
            city: orderCity,
            postalCode: orderPostalCode,
            targetAddress: {
              street: data.street ?? data.targetAreaName,
              houseNumber: data.houseNumber || null,
              postalCode: orderPostalCode,
              city: orderCity,
              country: "DE",
            },
            targetLat: data.centerLat ?? undefined,
            targetLng: data.centerLng ?? undefined,
            distributionAreaId,
            targetAreaName: data.targetAreaName,
            targetAreaGeoJson: targetAreaGeoJson ?? undefined,
            estimatedHouseholds: serverHouseholds || null,
            estimatedFlyers: data.flyerQuantity,
            estimatedDistanceMeters: serverDistanceMeters ?? null,
            coverageAreaSqm: serverCoverageAreaSqm ? new Prisma.Decimal(serverCoverageAreaSqm) : null,
            flyerQuantity: data.flyerQuantity,
            customerOwnFlyers: data.flyerSource === "CUSTOMER_OWN",
            needsPrintService: data.flyerSource === "PRINT_SERVICE",
            preferredStartDate: data.preferredStartDate,
            preferredEndDate: data.preferredEndDate,
            flexibleScheduling: data.flexibleScheduling,
            notes: [customerNotePrefix, printDataLabel, data.notes].filter(Boolean).join("\n"),
            contactPerson: data.contactPerson || null,
            contactPhone: data.contactPhone || null,
            calculatedNetPrice: price.net,
            calculatedVat: price.vat,
            calculatedGrossPrice: price.gross,
            priceRuleSnapshot: withCurrentPricingSnapshot({
              price,
              areaCalculationSnapshot: serverAreaSnapshot,
              snapshot: {
              ...price.snapshot,
              completionPath: data.completionPath,
              productFormat: data.productFormat,
              printDataStatus: data.printDataStatus,
              customerFacingPriceLabel: data.completionPath === "direct_payment"
                ? "Endpreis vorbehaltlich finaler Prüfung"
                : "Geschätzter Preis",
              reviewNotice: "Gebiet, Druckdaten und Zustellbarkeit werden durch FLYERO final geprüft.",
              includedProofs: ["GPS-Nachweis", "Foto-Dokumentation", "PDF-Bericht nach Abschluss"],
              areaCalculationSnapshot: serverAreaSnapshot,
              },
            }),
            distributionSegments: areaSelection ? {
              create: areaSelection.segments.map((segment, index) => {
                const intelligenceSegment = intelligence.metrics.segments?.[index];
                const warehouseMatch = intelligence.metrics.warehouseMatches?.[index];
                return {
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
                  dataSourceType: "ESTIMATED",
                  confidence: intelligenceSegment?.confidence === "high"
                    ? new Prisma.Decimal("1")
                    : intelligenceSegment?.confidence === "medium"
                      ? new Prisma.Decimal("0.6")
                      : new Prisma.Decimal("0.3"),
                  warehouseMatchStatus: warehouseMatch?.matchedRegion ? "MATCHED" : "MANUAL_REVIEW",
                  warehouseAssignmentReason: warehouseMatch?.reason ?? null,
                  assignedWarehouseId: warehouseMatch?.matchedRegion ? warehouseMatch.warehouse?.id ?? null : null,
                  distributionAreaId: intelligenceSegment?.distributionAreaId ?? segment.distributionAreaId,
                  notes: segment.notes,
                };
              }),
            } : undefined,
          },
        }));
        break;
      } catch (error) {
        const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : null;
        const isOrderNumberCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          (!target || target === "(not available)" || (Array.isArray(target) && target.includes("orderNumber")));
        if (!isOrderNumberCollision || attempt === 2) throw error;
      }
    }

    if (!order) {
      return errorResponse("Auftrag konnte nicht gespeichert werden.", 400);
    }

    await createOrderStatusEvent({
      orderId: order.id,
      toStatus: order.status,
      changedBy: session.id,
      note: data.completionPath === "direct_payment"
        ? "Kampagne durch Kunden erstellt. Zahlung ausstehend."
        : "Unverbindliche Anfrage durch Kunden erstellt.",
    });
    await createAuditLog({
      userId: session.id,
      tenantId: session.tenantId,
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      newValues: {
        orderNumber: order.orderNumber,
        status: order.status,
        flyerQuantity: order.flyerQuantity,
        calculatedGrossPrice: order.calculatedGrossPrice,
      },
    });
    if (distributionAreaId) {
      await linkAreaReferenceToOrder({
        orderId: order.id,
        areaId: distributionAreaId,
        userId: session.id,
      });
    }
    if (!requiresManualReview) {
      await assignWarehouseForOrder({
        orderId: order.id,
        userId: session.id,
        reserveCapacity: false,
      });
    }
    await createNotification({
      userId: session.id,
      type: requiresManualReview ? "ORDER_UNDER_REVIEW" : "ORDER_SUBMITTED",
      data: {
        orderNumber: order.orderNumber,
        flyerQuantity: order.flyerQuantity,
        areaName: order.targetAreaName,
        city: order.city,
        postalCode: order.postalCode,
        grossAmount: order.calculatedGrossPrice.toString(),
        nextStep: requiresManualReview ? "FLYERO prueft das Gebiet vor der Buchung." : data.completionPath === "direct_payment" ? "Zahlung starten." : "FLYERO meldet sich nach der Pruefung.",
      },
      title: "Auftrag erstellt",
      message: requiresManualReview
        ? `Auftrag ${order.orderNumber} wurde erstellt. Das Gebiet wird vor der Buchung manuell geprüft.`
        : data.completionPath === "direct_payment"
        ? `Auftrag ${order.orderNumber} wurde erstellt. Bitte starte jetzt die Zahlung.`
        : `Anfrage ${order.orderNumber} wurde übermittelt. Wir prüfen Gebiet, Druckdaten und Preis.`,
    });
    await prisma.orderExperienceEvent.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        tenantId: session.tenantId,
        userId: session.id,
        eventType: "ORDER_CREATED",
        city: order.city,
        postalCode: order.postalCode,
        areaName: order.targetAreaName,
        areaType: data.areaType ?? (targetAreaGeoJson ? "POLYGON" : "POSTAL_CODE"),
        usedSavedArea: Boolean(data.distributionAreaId),
        households: order.estimatedHouseholds,
        flyerQuantity: order.flyerQuantity,
        coverageAreaSqm: order.coverageAreaSqm,
        routeDistanceMeters: order.estimatedDistanceMeters,
        routeDurationMinutes: order.estimatedDistanceMeters
          ? Math.max(20, Math.round(order.estimatedDistanceMeters / 68 + (order.estimatedHouseholds ?? 0) * 0.38))
          : null,
        metadata: {
          source: "api/customer/orders",
          completionPath: data.completionPath,
          printDataStatus: data.printDataStatus,
          needsPrintService: order.needsPrintService,
          assignedWarehouseId: order.assignedWarehouseId,
          segmentCount: areaSelection?.segments.length ?? 0,
          needsManualReview: requiresManualReview,
        },
      },
    });
    await notifyAdmins({
      type: "ADMIN_NEW_ORDER",
      title: requiresManualReview ? "Neue Kampagne zur manuellen Prüfung" : "Neue Kampagne eingegangen",
      message: `${order.orderNumber}: ${order.targetAreaName}, ${order.flyerQuantity} Flyer.`,
      data: {
        orderNumber: order.orderNumber,
        flyerQuantity: order.flyerQuantity,
        areaName: order.targetAreaName,
        city: order.city,
        postalCode: order.postalCode,
        companyName: customer.companyName,
      },
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/customer/orders/${order.id}`, request.url), {
        status: 303,
      });
    }

    return Response.json({
      ok: true,
      data: {
        ...order,
        requiresManualReview,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return errorResponse("Auftrag konnte nicht gespeichert werden.", 400);
    }

    return routeErrorResponse(error);
  }
}
