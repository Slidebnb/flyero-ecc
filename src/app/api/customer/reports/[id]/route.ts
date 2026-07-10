import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { collectReportData, sanitizeReportForCustomer } from "@/lib/reports";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteProps = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await params;
    const report = await prisma.report.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        order: { customer: { userId: session.id } },
        tour: { status: "APPROVED" },
      },
      include: {
        order: true,
        tour: true,
      },
    });
    if (!report) return errorResponse("Berichtsvorschau wurde nicht gefunden.", 404);
    await createAuditLog({
      userId: session.id,
      action: "report.viewed",
      entityType: "Report",
      entityId: report.id,
    });
    const data = await collectReportData(report.tourId);
    return Response.json({ ok: true, data: { report, customerView: sanitizeReportForCustomer(data) } });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
