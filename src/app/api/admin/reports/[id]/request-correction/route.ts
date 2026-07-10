import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { requestReportCorrection } from "@/lib/reports";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const formData = request.headers.get("content-type")?.includes("form")
      ? await request.formData()
      : null;
    const message = formData ? String(formData.get("message") ?? "") || undefined : undefined;
    const report = await requestReportCorrection({ reportId: id, adminUserId: session.id, message });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/reports/${id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: report });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Korrektur konnte nicht angefordert werden.", 400);
    }
  }
}
