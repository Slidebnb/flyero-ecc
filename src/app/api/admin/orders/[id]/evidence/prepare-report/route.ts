import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prepareExternalReportForOrder } from "@/lib/externalEvidence";
import { errorResponse, routeErrorResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const payload = request.headers.get("content-type")?.includes("form")
      ? Object.fromEntries((await request.formData()).entries())
      : await request.json();
    const report = await prepareExternalReportForOrder({ actor, orderId: id, payload });
    if (request.headers.get("accept")?.includes("text/html")) {
      return NextResponse.redirect(new URL(`/admin/reports/${report.id}`, request.url), { status: 303 });
    }
    return Response.json({ ok: true, data: report });
  } catch (error) {
    try {
      return routeErrorResponse(error);
    } catch {
      return errorResponse(error instanceof Error ? error.message : "Bericht konnte nicht vorbereitet werden.", 400);
    }
  }
}
