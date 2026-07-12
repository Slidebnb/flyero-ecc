import { NextRequest } from "next/server";
import { addDocumentComment } from "@/lib/documents";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    return successResponse(await addDocumentComment(session, id, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
