import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { productionAccountingExportWhere } from "@/lib/productionData";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(Permission.ACCOUNTING_EXPORT);
    const { id } = await context.params;
    const accountingExport = await prisma.accountingExport.findFirst({
      where: { id, ...productionAccountingExportWhere() },
      include: { createdBy: { select: { email: true } }, items: { orderBy: { createdAt: "asc" } } },
    });
    if (!accountingExport) throw new Error("Export wurde nicht gefunden.");
    return successResponse(accountingExport);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
