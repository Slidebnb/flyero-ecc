import { readFile } from "node:fs/promises";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { markReportDownloaded } from "@/lib/reports";
import { errorResponse, routeErrorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await context.params;
    const report = await prisma.report.findFirst({
      where: {
        id,
        status: { in: ["GENERATED", "APPROVED", "PUBLISHED"] },
        order: { customer: { userId: session.id } },
      },
    });
    if (!report?.pdfUrl) return errorResponse("PDF wurde nicht gefunden.", 404);
    const relativePath = report.pdfUrl.replace(/^\/+/, "");
    const file = await readFile(path.join(process.cwd(), "public", relativePath));
    await markReportDownloaded({ reportId: report.id, userId: session.id });
    return new Response(file, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${report.reportNumber}.pdf"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
