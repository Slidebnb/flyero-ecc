import { archiveExport } from "@/lib/accountingExport";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.ACCOUNTING_EXPORT_ARCHIVE);
    const { id } = await context.params;
    return successResponse(await archiveExport({ exportId: id, userId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
