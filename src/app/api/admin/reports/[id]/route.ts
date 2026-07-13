import { Permission, requirePermission } from "@/lib/permissions";
import { collectReportData } from "@/lib/reports";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { tenantWhereForSession } from "@/lib/tenantPolicy";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.REPORT_REVIEW);
    const { id } = await context.params;
    const report = await prisma.report.findUnique({
      where: { id, ...tenantWhereForSession(session) },
      include: {
        order: { include: { customer: true } },
        tour: {
          include: {
            distributor: { include: { user: { select: { id: true, email: true, role: true, status: true } } } },
            gpsPoints: true,
            photoProofs: true,
          },
        },
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
