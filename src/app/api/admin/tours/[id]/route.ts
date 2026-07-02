import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    await requireRole([UserRole.ADMIN]);
    const { id } = await params;
    const tour = await prisma.distributionTour.findUnique({
      where: { id },
      include: {
        distributor: { include: { user: true } },
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
