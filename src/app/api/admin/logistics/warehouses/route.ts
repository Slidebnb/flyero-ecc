import { UserRole } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { warehouseSourceWhere } from "@/lib/warehouse";

export async function GET() {
  try {
    const session = await requirePermission(Permission.WAREHOUSE_VIEW);
    const tenantId = session.role === UserRole.ADMIN ? undefined : session.tenantId ?? "__no_tenant__";
    const warehouses = await prisma.warehouse.findMany({
      where: warehouseSourceWhere(),
      include: {
        regions: { orderBy: [{ priority: "desc" }, { name: "asc" }] },
        _count: {
          select: {
            inventories: tenantId === undefined ? true : { where: { order: { tenantId } } },
            shipments: tenantId === undefined ? true : { where: { order: { tenantId } } },
            transfersFrom: tenantId === undefined ? true : { where: { inventory: { order: { tenantId } } } },
            transfersTo: tenantId === undefined ? true : { where: { inventory: { order: { tenantId } } } },
            stockCounts: tenantId === undefined ? true : { where: { inventory: { order: { tenantId } } } },
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return successResponse(warehouses);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
