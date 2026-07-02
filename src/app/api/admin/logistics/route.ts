import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { getLogisticsAnalytics } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const [analytics, openShipments, transfers, stockDifferences] = await Promise.all([
      getLogisticsAnalytics(),
      prisma.logisticsShipment.findMany({
        where: { status: { in: ["CREATED", "IN_TRANSIT", "DELIVERED"] } },
        include: { order: true, warehouse: true },
        orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.warehouseTransfer.findMany({
        where: { status: { in: ["REQUESTED", "APPROVED", "IN_TRANSIT"] } },
        include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.warehouseStockCount.findMany({
        where: { difference: { not: 0 } },
        include: { warehouse: true, inventory: { include: { order: true } } },
        orderBy: { countedAt: "desc" },
        take: 20,
      }),
    ]);
    return successResponse({ analytics, openShipments, transfers, stockDifferences });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
