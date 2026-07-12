import { NextRequest } from "next/server";
import { getDocument, updateDocument } from "@/lib/documents";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    return successResponse(await getDocument(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    return successResponse(await updateDocument(session, id, await readBody(request)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
