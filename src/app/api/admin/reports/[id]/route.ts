import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { collectReportData } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        order: { include: { customer: true } },
        tour: { include: { distributor: { include: { user: true } }, gpsPoints: true, photoProofs: true } },
        customer: true,
      },
    });
    if (!report) return errorResponse("Report wurde nicht gefunden.", 404);
    const data = await collectReportData(report.tourId);
    return Response.json({ ok: true, data: { report, details: data } });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
