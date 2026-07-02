import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { getDistributorProfileForUser } from "@/lib/tours";

export async function GET() {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const profile = await getDistributorProfileForUser(session.id);
    const tours = await prisma.distributionTour.findMany({
      where: { distributorId: profile.id },
      include: {
        order: { include: { customer: true } },
        inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
        gpsPoints: { orderBy: { recordedAt: "desc" }, take: 1 },
        photoProofs: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: tours });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
