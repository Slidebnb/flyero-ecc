import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse } from "@/lib/request";
import { warehouseLocationAssignSchema } from "@/lib/validators";
import { logWarehouseHistory } from "@/lib/warehouse";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN]);
    const parsed = warehouseLocationAssignSchema.safeParse(await readBody(request));
    if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message || "Ungueltige Eingabe.");
    const inventory = await prisma.warehouseInventory.findFirst({ where: { id: parsed.data.inventoryId, ...inventoryScopeForUser(session) } });
    if (!inventory) return errorResponse("Lagerbestand wurde nicht gefunden.", 404);
    const location = await prisma.warehouseLocation.findUnique({ where: { id: parsed.data.warehouseLocationId } });
    if (!location) return errorResponse("Lagerplatz wurde nicht gefunden.", 404);
    if (session.role === UserRole.WAREHOUSE_STAFF && session.warehouseId !== location.warehouseId) {
      return errorResponse("Dieser Lagerplatz gehoert nicht zu deinem Lager.", 403);
    }
    const updated = await prisma.warehouseInventory.update({
      where: { id: parsed.data.inventoryId },
      data: { warehouseLocationId: parsed.data.warehouseLocationId, warehouseId: location.warehouseId },
    });
    await logWarehouseHistory({
      inventoryId: updated.id,
      action: "warehouse.location_assigned",
      userId: session.id,
      oldValue: { warehouseLocationId: inventory.warehouseLocationId },
      newValue: { warehouseLocationId: updated.warehouseLocationId },
    });
    await createAuditLog({
      userId: session.id,
      action: "warehouse.location_assigned",
      entityType: "WarehouseInventory",
      entityId: updated.id,
      oldValues: { warehouseLocationId: inventory.warehouseLocationId },
      newValues: { warehouseLocationId: updated.warehouseLocationId },
    });
    if (request.headers.get("accept")?.includes("text/html")) {
      const referer = request.headers.get("referer") || `/warehouse/inventory/${updated.id}`;
      return NextResponse.redirect(referer, { status: 303 });
    }
    return Response.json({ ok: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
