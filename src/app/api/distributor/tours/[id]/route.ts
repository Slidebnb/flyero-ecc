import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { getDistributorProfileForUser } from "@/lib/tours";
import { distributorInventorySelect, distributorOrderSelect } from "@/lib/distributorPrivacy";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_OPERATIONS_VIEW);
    const profile = await getDistributorProfileForUser(session.id);
    const { id } = await params;
    const tour = await prisma.distributionTour.findFirst({
      where: { id, distributorId: profile.id },
      include: {
        order: { select: distributorOrderSelect },
        inventory: { select: distributorInventorySelect },
        gpsPoints: { orderBy: { recordedAt: "asc" } },
        photoProofs: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!tour) return errorResponse("Tour wurde nicht gefunden.", 404);
    return Response.json({ ok: true, data: tour });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
