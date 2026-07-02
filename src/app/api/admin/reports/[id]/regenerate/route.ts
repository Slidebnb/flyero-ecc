import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logBackgroundJobFailure, logBackgroundJobStart, logBackgroundJobSuccess } from "@/lib/monitoring";
import { regenerateReport } from "@/lib/reports";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  let jobId: string | null = null;
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const job = await logBackgroundJobStart("PDF_GENERATION", { reportId: id, regenerate: true });
    jobId = job.id;
    const report = await regenerateReport({ reportId: id, adminUserId: session.id });
    await logBackgroundJobSuccess(job.id, { reportId: report.id });
    if (request.headers.get("accept")?.includes("text/html")) return NextResponse.redirect(new URL(`/admin/reports/${id}`, request.url), { status: 303 });
    return Response.json({ ok: true, data: report });
  } catch (error) {
    if (jobId) await logBackgroundJobFailure(jobId, error);
    try { return routeErrorResponse(error); } catch { return errorResponse(error instanceof Error ? error.message : "Bericht konnte nicht neu generiert werden.", 400); }
  }
}
