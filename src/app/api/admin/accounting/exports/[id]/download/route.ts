import { createAuditLog } from "@/lib/audit";
import { Permission, requirePermission } from "@/lib/permissions";
import { readGeneratedAsset } from "@/lib/generatedAssets";
import { privateDownloadHeaders } from "@/lib/downloadHeaders";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse } from "@/lib/request";
import { productionAccountingExportWhere } from "@/lib/productionData";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.ACCOUNTING_EXPORT_DOWNLOAD);
    const { id } = await context.params;
    const accountingExport = await prisma.accountingExport.findFirst({ where: { id, ...productionAccountingExportWhere() } });
    if (!accountingExport?.fileUrl) throw new Error("Exportdatei wurde nicht gefunden.");
    const file = await readGeneratedAsset(accountingExport.fileUrl);
    await createAuditLog({ userId: session.id, action: "accounting.export_downloaded", entityType: "AccountingExport", entityId: accountingExport.id });
    return new Response(file.buffer, {
      headers: privateDownloadHeaders({ contentType: "text/csv; charset=utf-8", filename: `flyero-accounting-export-${accountingExport.exportNumber}.csv` }),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
