import { Permission, requirePermission } from "@/lib/permissions";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { privateDownloadHeaders } from "@/lib/downloadHeaders";
import { prisma } from "@/lib/prisma";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { tenantWhereForSession } from "@/lib/tenantPolicy";
import { productionReportWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.REPORT_REVIEW);
    const { id } = await context.params;
    const report = await prisma.report.findFirst({ where: { id, ...tenantWhereForSession(session), ...productionReportWhere() } });
    if (!report?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const file = await readGeneratedAsset(report.pdfUrl);
    return new Response(file.buffer, {
      headers: privateDownloadHeaders({ contentType: "application/pdf", filename: `${report.reportNumber}.pdf` }),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
