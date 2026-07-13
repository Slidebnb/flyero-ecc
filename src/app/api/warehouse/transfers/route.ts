import { prisma } from "@/lib/prisma";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { transferScopeForUser } from "@/lib/logistics";
import { warehouseOrderSelect, warehouseSelect } from "@/lib/warehousePrivacy";

export async function GET() {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_OPERATIONS_VIEW);
    const transfers = await prisma.warehouseTransfer.findMany({
      where: transferScopeForUser(session),
      select: {
        id: true,
        status: true,
        quantity: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        fromWarehouse: { select: warehouseSelect },
        toWarehouse: { select: warehouseSelect },
        inventory: { select: { id: true, order: { select: warehouseOrderSelect } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return successResponse(transfers);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
