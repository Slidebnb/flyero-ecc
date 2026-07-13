import { shipmentScopeForUser } from "@/lib/logistics";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseOrderSelect, warehouseSelect } from "@/lib/warehousePrivacy";

export async function GET() {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_VIEW);
    const shipments = await prisma.logisticsShipment.findMany({
      where: shipmentScopeForUser(session),
      select: {
        id: true,
        warehouseId: true,
        shipmentType: true,
        status: true,
        trackingNumber: true,
        expectedDeliveryDate: true,
        order: { select: warehouseOrderSelect },
        warehouse: { select: warehouseSelect },
      },
      orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(shipments);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
