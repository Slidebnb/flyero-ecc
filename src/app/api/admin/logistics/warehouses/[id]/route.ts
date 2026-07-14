import { Prisma, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { logisticsWarehouseUpdateSchema } from "@/lib/validators";
import { warehouseSourceWhere } from "@/lib/warehouse";
import { productionOrderWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_VIEW);
    const { id } = await context.params;
    const orderTenantWhere = { ...productionOrderWhere(), ...(session.role === UserRole.ADMIN ? {} : { tenantId: session.tenantId ?? "__no_tenant__" }) };
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, ...warehouseSourceWhere() },
      include: {
        regions: { orderBy: [{ priority: "desc" }, { name: "asc" }] },
        locations: { orderBy: { fullLabel: "asc" } },
        inventories: {
          where: { order: orderTenantWhere },
          select: {
            id: true,
            status: true,
            remainingStockStatus: true,
            expectedFlyers: true,
            receivedFlyers: true,
            remainingFlyers: true,
            damagedFlyers: true,
            warehouseLocation: { select: { id: true, fullLabel: true } },
            order: { select: { id: true, orderNumber: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        },
        shipments: {
          where: { order: orderTenantWhere },
          select: {
            id: true,
            shipmentType: true,
            status: true,
            trackingNumber: true,
            expectedDeliveryDate: true,
            deliveredAt: true,
            order: { select: { id: true, orderNumber: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        transfersFrom: {
          where: { inventory: { order: orderTenantWhere } },
          select: {
            id: true,
            status: true,
            quantity: true,
            toWarehouse: { select: { id: true, name: true, code: true } },
            inventory: { select: { id: true, order: { select: { id: true, orderNumber: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        transfersTo: {
          where: { inventory: { order: orderTenantWhere } },
          select: {
            id: true,
            status: true,
            quantity: true,
            fromWarehouse: { select: { id: true, name: true, code: true } },
            inventory: { select: { id: true, order: { select: { id: true, orderNumber: true } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        stockCounts: {
          where: { inventory: { order: orderTenantWhere } },
          select: {
            id: true,
            expectedQuantity: true,
            countedQuantity: true,
            difference: true,
            countedAt: true,
            inventory: { select: { id: true, order: { select: { id: true, orderNumber: true } } } },
          },
          orderBy: { countedAt: "desc" },
          take: 25,
        },
      },
    });
    if (!warehouse) return errorResponse("Lager wurde nicht gefunden.", 404);
    return successResponse(warehouse);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_MANAGE);
    const { id } = await context.params;
    const parsed = logisticsWarehouseUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const existing = await prisma.warehouse.findFirst({ where: { id, ...warehouseSourceWhere() }, select: { id: true } });
    if (!existing) return errorResponse("Lager wurde nicht gefunden.", 404);
    const data = parsed.data;
    const update: Prisma.WarehouseUpdateInput = {
      name: data.name,
      code: data.code,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      region: data.region,
      latitude: data.latitude == null ? undefined : new Prisma.Decimal(data.latitude),
      longitude: data.longitude == null ? undefined : new Prisma.Decimal(data.longitude),
      openingHours: data.openingHours,
      contactPerson: data.contactPerson,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      capacityLimit: data.capacityLimit,
      currentUtilization: data.currentUtilization,
      notes: data.notes,
      isActive: data.isActive,
      isDefault: data.isDefault,
    };
    const warehouse = await prisma.warehouse.update({ where: { id }, data: update });
    await createAuditLog({ userId: session.id, action: "logistics.warehouse_updated", entityType: "Warehouse", entityId: id, newValues: warehouse });
    return successResponse(warehouse);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
