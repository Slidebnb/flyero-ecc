import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { getDistributorProfileForUser } from "@/lib/tours";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.DISTRIBUTOR]);
    const profile = await getDistributorProfileForUser(session.id);
    const { id } = await params;
    const tour = await prisma.distributionTour.findFirst({
      where: { id, distributorId: profile.id },
      include: {
        order: { include: { customer: true } },
        inventory: { include: { warehouseLocation: { include: { warehouse: true } } } },
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
