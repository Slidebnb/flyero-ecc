import { Permission, requirePermission } from "@/lib/permissions";
import { rescanDocument } from "@/lib/documents";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_SCAN);
    const { id } = await context.params;
    return successResponse(await rescanDocument(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
