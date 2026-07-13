import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createWarehouseStockCount, inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { requireActiveTenantMembership } from "@/lib/tenantPolicy";
import { warehouseStockCountCreateSchema } from "@/lib/validators";
import { warehouseOrderSelect, warehouseSelect } from "@/lib/warehousePrivacy";

export async function GET() {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    if (session.role !== UserRole.ADMIN) await requireActiveTenantMembership(session);
    const counts = await prisma.warehouseStockCount.findMany({
      where: session.role === UserRole.ADMIN
        ? {}
        : {
            inventory: inventoryScopeForUser(session),
            ...(session.role === UserRole.WAREHOUSE_STAFF ? { warehouseId: session.warehouseId || "__none__" } : {}),
          },
      select: {
        id: true,
        expectedQuantity: true,
        countedQuantity: true,
        difference: true,
        countedAt: true,
        warehouse: { select: warehouseSelect },
        inventory: { select: { id: true, order: { select: warehouseOrderSelect } } },
      },
      orderBy: { countedAt: "desc" },
      take: 200,
    });
    return successResponse(counts);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    if (session.role !== UserRole.ADMIN) await requireActiveTenantMembership(session);
    const parsed = warehouseStockCountCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const inventory = await prisma.warehouseInventory.findFirst({
      where: { id: parsed.data.inventoryId, ...inventoryScopeForUser(session) },
      select: { id: true, warehouseId: true },
    });
    if (!inventory) return errorResponse("Bestand wurde nicht gefunden oder ist nicht berechtigt.", 404);
    const warehouseId = session.role === UserRole.ADMIN ? parsed.data.warehouseId : inventory.warehouseId;
    if (!warehouseId) return errorResponse("Kein Lager zugeordnet.", 403);
    if (session.role === UserRole.WAREHOUSE_STAFF && session.warehouseId !== warehouseId) {
      return errorResponse("Dieses Lager ist deinem Zugang nicht zugeordnet.", 403);
    }
    return successResponse(await createWarehouseStockCount({
      ...parsed.data,
      warehouseId,
      countedById: session.id,
      tenantId: session.role === UserRole.SUPPORT_DISPATCHER ? session.tenantId : undefined,
    }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
