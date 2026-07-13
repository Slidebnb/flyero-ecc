import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { distributorInventorySelect, distributorOrderSelect } from "@/lib/distributorPrivacy";
import { getDistributorProfileForUser } from "@/lib/tours";

export async function GET() {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_VIEW);
    const profile = await getDistributorProfileForUser(session.id);
    const tours = await prisma.distributionTour.findMany({
      where: { distributorId: profile.id },
      include: {
        order: { select: distributorOrderSelect },
        inventory: { select: distributorInventorySelect },
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
