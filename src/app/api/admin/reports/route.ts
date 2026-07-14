import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { tenantWhereForSession } from "@/lib/tenantPolicy";
import { productionReportWhere } from "@/lib/productionData";

export async function GET() {
  try {
    const session = await requirePermission(Permission.REPORT_REVIEW);
    const reports = await prisma.report.findMany({
      where: { ...tenantWhereForSession(session), ...productionReportWhere() },
      include: { order: { include: { customer: true } }, tour: true, customer: true },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ ok: true, data: reports });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
