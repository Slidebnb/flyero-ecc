import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createWarehouseStockCount, inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseStockCountCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const counts = await prisma.warehouseStockCount.findMany({
      where: session.role === UserRole.WAREHOUSE_STAFF ? { warehouseId: session.warehouseId || "__none__" } : {},
      include: { warehouse: true, inventory: { include: { order: true } }, countedBy: true },
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
    const parsed = warehouseStockCountCreateSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const inventory = await prisma.warehouseInventory.findFirst({
      where: { id: parsed.data.inventoryId, ...inventoryScopeForUser(session) },
    });
    if (!inventory) return errorResponse("Bestand wurde nicht gefunden oder ist nicht berechtigt.", 404);
    const warehouseId = session.role === UserRole.WAREHOUSE_STAFF ? session.warehouseId || parsed.data.warehouseId : parsed.data.warehouseId;
    if (!warehouseId) return errorResponse("Kein Lager zugeordnet.", 403);
    return successResponse(await createWarehouseStockCount({ ...parsed.data, warehouseId, countedById: session.id }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
