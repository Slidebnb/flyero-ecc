import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const recommendations = await prisma.autoDispatchRecommendation.findMany({
      include: { order: { include: { customer: true } }, distributor: true },
      orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    return successResponse(recommendations);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
