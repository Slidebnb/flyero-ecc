import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { shipmentScopeForUser } from "@/lib/logistics";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.WAREHOUSE_STAFF, UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const shipments = await prisma.logisticsShipment.findMany({
      where: shipmentScopeForUser(session),
      include: { order: { include: { customer: true } }, warehouse: true },
      orderBy: [{ expectedDeliveryDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(shipments);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
