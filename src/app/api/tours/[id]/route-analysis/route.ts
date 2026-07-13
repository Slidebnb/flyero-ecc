import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { auditRouteAnalysis, analyzeRoute, normalizeRoutePoint } from "@/lib/routeAnalysis";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.CUSTOMER, UserRole.DISTRIBUTOR]);
    const { id } = await params;
    const accessWhere =
      session.role === UserRole.ADMIN
        ? { id }
        : session.role === UserRole.CUSTOMER
          ? { id, order: { customer: { userId: session.id } } }
          : { id, distributor: { userId: session.id } };
    const tour = await prisma.distributionTour.findFirst({
      where: accessWhere,
      select: {
        id: true,
        totalPauseSeconds: true,
        order: { select: { targetAreaGeoJson: true } },
        gpsPoints: { orderBy: { recordedAt: "asc" } },
      },
    });
    if (!tour) return errorResponse("Tour wurde nicht gefunden.", 404);
    const analysis = analyzeRoute({
      points: tour.gpsPoints.map(normalizeRoutePoint),
      pauseSeconds: tour.totalPauseSeconds,
      targetAreaGeoJson: tour.order.targetAreaGeoJson,
    });
    await auditRouteAnalysis({ userId: session.id, tourId: tour.id, analysis });
    return Response.json({ ok: true, data: analysis });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
