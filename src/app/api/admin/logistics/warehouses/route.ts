import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const warehouses = await prisma.warehouse.findMany({
      include: {
        regions: { orderBy: [{ priority: "desc" }, { name: "asc" }] },
        _count: { select: { inventories: true, shipments: true, transfersFrom: true, transfersTo: true, stockCounts: true } },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    return successResponse(warehouses);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
