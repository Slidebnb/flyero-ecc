import { Prisma, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { logisticsWarehouseUpdateSchema } from "@/lib/validators";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        regions: { orderBy: [{ priority: "desc" }, { name: "asc" }] },
        locations: { orderBy: { fullLabel: "asc" } },
        inventories: { include: { order: true, warehouseLocation: true }, orderBy: { updatedAt: "desc" }, take: 50 },
        shipments: { include: { order: true }, orderBy: { createdAt: "desc" }, take: 50 },
        transfersFrom: { include: { toWarehouse: true, inventory: { include: { order: true } } }, orderBy: { createdAt: "desc" }, take: 25 },
        transfersTo: { include: { fromWarehouse: true, inventory: { include: { order: true } } }, orderBy: { createdAt: "desc" }, take: 25 },
        stockCounts: { include: { inventory: { include: { order: true } }, countedBy: true }, orderBy: { countedAt: "desc" }, take: 25 },
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
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const parsed = logisticsWarehouseUpdateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
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
