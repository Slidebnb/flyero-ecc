import { requireTenantSession } from "@/lib/tenant";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { markReportDownloaded } from "@/lib/reports";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const report = await prisma.report.findFirst({
      where: {
        id,
        tenantId: session.tenantId,
        status: "PUBLISHED",
        order: { customer: { userId: session.id, tenantId: session.tenantId }, tenantId: session.tenantId },
      },
    });
    if (!report?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const file = await readGeneratedAsset(report.pdfUrl);
    await markReportDownloaded({ reportId: report.id, userId: session.id });
    return new Response(file.buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${report.reportNumber}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
