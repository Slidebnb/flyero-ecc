import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { transferScopeForUser } from "@/lib/logistics";

export async function GET() {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const transfers = await prisma.warehouseTransfer.findMany({
      where: transferScopeForUser(session),
      include: { fromWarehouse: true, toWarehouse: true, inventory: { include: { order: true } }, requestedBy: true, approvedBy: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return successResponse(transfers);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
