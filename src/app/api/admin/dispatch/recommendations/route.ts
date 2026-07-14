import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { productionDistributorWhere, productionOrderWhere } from "@/lib/productionData";

export async function GET() {
  try {
    const session = await requirePermission(Permission.DISPATCH_VIEW);
    const recommendations = await prisma.autoDispatchRecommendation.findMany({
      where: { order: { ...productionOrderWhere(), ...(session.role === UserRole.ADMIN ? {} : { tenantId: session.tenantId ?? "__no_tenant__" }) }, distributor: productionDistributorWhere() },
      include: { order: { include: { customer: true } }, distributor: true },
      orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(recommendations);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
