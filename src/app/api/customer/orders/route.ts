import { Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { assignAreaToOrder, createDistributionArea } from "@/lib/areas";
import { createNotification } from "@/lib/notifications";
import { assignWarehouseForOrder } from "@/lib/logistics";
import { generateOrderNumber, createOrderStatusEvent } from "@/lib/orders";
import { calculateOrderPrice } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { orderCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const customer = await prisma.customerProfile.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });

    if (!customer) {
      return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    }

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
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
    const session = await requireRole([UserRole.CUSTOMER]);
    const parsed = orderCreateSchema.safeParse(await readBody(request));

    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    }

    const customer = await prisma.customerProfile.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });

    if (!customer) {
      return errorResponse("Kundenprofil wurde nicht gefunden.", 404);
    }

    const data = parsed.data;
    let distributionAreaId = data.distributionAreaId ?? null;

    if (!distributionAreaId) {
      const area = await createDistributionArea({
        userId: session.id,
        customerId: customer.id,
        name: data.targetAreaName,
        type: data.areaType ?? (data.targetAreaGeoJson ? "POLYGON" : "POSTAL_CODE"),
        city: data.city,
        postalCode: data.postalCode,
        district: data.areaType === "DISTRICT" ? data.targetAreaName : null,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusMeters: data.radiusMeters,
        geoJson: data.targetAreaGeoJson,
        coverageAreaSqm: data.coverageAreaSqm,
        estimatedHouseholds: data.estimatedHouseholds,
        estimatedFlyers: data.estimatedFlyers ?? data.flyerQuantity,
        estimatedDistanceMeters: data.estimatedDistanceMeters,
        reusable: false,
      });
      distributionAreaId = area.id;
    }

    const price = await calculateOrderPrice({
      serviceType: data.serviceType,
      flyerQuantity: data.flyerQuantity,
    });

    let order: Awaited<ReturnType<typeof prisma.order.create>> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await prisma.order.create({
          data: {
            orderNumber: await generateOrderNumber(),
            customerId: customer.id,
            status: "PAYMENT_PENDING",
            serviceType: data.serviceType,
            city: data.city,
            postalCode: data.postalCode,
            targetAddress: {
              street: data.street ?? data.targetAreaName,
              houseNumber: data.houseNumber || null,
              postalCode: data.postalCode,
              city: data.city,
              country: "DE",
            },
            distributionAreaId,
            targetAreaName: data.targetAreaName,
            targetAreaGeoJson: data.targetAreaGeoJson ?? undefined,
            estimatedHouseholds: data.estimatedHouseholds || null,
            estimatedFlyers: data.estimatedFlyers ?? data.flyerQuantity,
            estimatedDistanceMeters: data.estimatedDistanceMeters ?? null,
            coverageAreaSqm: data.coverageAreaSqm ? new Prisma.Decimal(data.coverageAreaSqm) : null,
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
            priceRuleSnapshot: price.snapshot,
          },
        });
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
      note: "Auftrag durch Kunden erstellt.",
    });
    await createAuditLog({
      userId: session.id,
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
      await assignAreaToOrder({
        orderId: order.id,
        areaId: distributionAreaId,
        userId: session.id,
      });
    }
    await assignWarehouseForOrder({
      orderId: order.id,
      userId: session.id,
      reserveCapacity: false,
    });
    await createNotification({
      userId: session.id,
      type: "ORDER_CREATED",
      title: "Auftrag erstellt",
        message: `Auftrag ${order.orderNumber} wurde erstellt. Bitte starte jetzt die Zahlung per Stripe Checkout.`,
      });
    await prisma.orderExperienceEvent.create({
      data: {
        orderId: order.id,
        customerId: customer.id,
        userId: session.id,
        eventType: "ORDER_CREATED",
        city: order.city,
        postalCode: order.postalCode,
        areaName: order.targetAreaName,
        areaType: data.areaType ?? (data.targetAreaGeoJson ? "POLYGON" : "POSTAL_CODE"),
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
          needsPrintService: order.needsPrintService,
          assignedWarehouseId: order.assignedWarehouseId,
        },
      },
    });

    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/customer/orders/${order.id}`, request.url), {
        status: 303,
      });
    }

    return Response.json({ ok: true, data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return errorResponse("Auftrag konnte nicht gespeichert werden.", 400);
    }

    return routeErrorResponse(error);
  }
}
