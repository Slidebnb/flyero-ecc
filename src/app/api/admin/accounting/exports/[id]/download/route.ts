import { UserRole } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const accountingExport = await prisma.accountingExport.findUnique({ where: { id } });
    if (!accountingExport?.fileUrl) throw new Error("Exportdatei wurde nicht gefunden.");
    const file = await readGeneratedAsset(accountingExport.fileUrl);
    await createAuditLog({ userId: session.id, action: "accounting.export_downloaded", entityType: "AccountingExport", entityId: accountingExport.id });
    return new Response(file.buffer, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="flyero-accounting-export-${accountingExport.exportNumber}.csv"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
