import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET() {
  try {
    await requirePermission(Permission.WAREHOUSE_OPERATIONS_VIEW);
    const [expectedToday, receivedToday, readyForPickup, pickedUp, remainingStock] =
      await Promise.all([
        prisma.warehouseInventory.count({ where: { status: "FLYERS_EXPECTED" } }),
        prisma.warehouseInventory.count({ where: { status: "FLYERS_RECEIVED" } }),
        prisma.warehouseInventory.count({ where: { status: "READY_FOR_PICKUP" } }),
        prisma.warehouseInventory.count({ where: { status: "PICKED_UP" } }),
        prisma.warehouseInventory.count({ where: { remainingStockStatus: "RESTBESTAND" } }),
      ]);

    return Response.json({
      ok: true,
      data: { expectedToday, receivedToday, readyForPickup, pickedUp, remainingStock },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
