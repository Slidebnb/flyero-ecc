import { NextRequest, NextResponse } from "next/server";
import { archiveReport } from "@/lib/reports";
import { Permission, requirePermission } from "@/lib/permissions";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { tenantWhereForSession } from "@/lib/tenantPolicy";
import { productionReportWhere } from "@/lib/productionData";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.REPORT_PUBLISH);
    const { id } = await context.params;
    const scopedReport = await prisma.report.findFirst({ where: { id, ...tenantWhereForSession(session), ...productionReportWhere() }, select: { id: true } });
    if (!scopedReport) return errorResponse("Bericht wurde nicht gefunden.", 404);
    const report = await archiveReport({ reportId: id, adminUserId: session.id });
    if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/reports/${id}`, request.url), { status: 303 });
    return Response.json({ ok: true, data: report });
  } catch (error) {
    try { return routeErrorResponse(error); } catch { return errorResponse(error instanceof Error ? error.message : "Bericht konnte nicht archiviert werden.", 400); }
  }
}
