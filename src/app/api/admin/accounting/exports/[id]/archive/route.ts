import { UserRole } from "@prisma/client";
import { archiveExport } from "@/lib/accountingExport";
import { requireRole } from "@/lib/auth";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    return successResponse(await archiveExport({ exportId: id, userId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
