import { createAuditLog } from "@/lib/audit";
import { errorResponse } from "@/lib/request";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { code } = await context.params;
  const report = await prisma.report.findUnique({
    where: { verificationCode: code },
    include: { order: true },
  });
  await createAuditLog({
    action: "report.verify_checked",
    entityType: "Report",
    entityId: report?.id ?? code,
    newValues: { found: Boolean(report), code },
  });
  if (!report) return errorResponse("Prüfcode wurde nicht gefunden.", 404);
  return Response.json({
    ok: true,
    data: {
      reportNumber: report.reportNumber,
      status: report.status,
      orderNumber: report.order.orderNumber,
      generatedAt: report.generatedAt,
      checksum: report.checksum,
    },
  });
}
