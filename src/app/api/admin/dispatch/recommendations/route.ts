import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const recommendations = await prisma.autoDispatchRecommendation.findMany({
      where: session.role === UserRole.ADMIN ? {} : { order: { tenantId: session.tenantId ?? "__no_tenant__" } },
      include: { order: { include: { customer: true } }, distributor: true },
      orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(recommendations);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
