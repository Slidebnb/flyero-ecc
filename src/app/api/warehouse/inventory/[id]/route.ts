import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { inventoryScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { warehouseLocationSelect, warehouseOrderSelect } from "@/lib/warehousePrivacy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN]);
    const { id } = await context.params;
    const inventory = await prisma.warehouseInventory.findFirst({
      where: { id, ...inventoryScopeForUser(session) },
      select: {
        id: true,
        status: true,
        qrCodePngDataUrl: true,
        warehouseId: true,
        warehouseLocationId: true,
        expectedFlyers: true,
        receivedFlyers: true,
        remainingFlyers: true,
        damagedFlyers: true,
        remainingStockStatus: true,
        pickupStatus: true,
        notes: true,
        order: { select: warehouseOrderSelect },
        warehouseLocation: { select: warehouseLocationSelect },
        history: { orderBy: { createdAt: "asc" }, select: { id: true, action: true, createdAt: true, user: { select: { role: true } } } },
      },
    });
    if (!inventory) return errorResponse("Lagerbestand wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: inventory });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
