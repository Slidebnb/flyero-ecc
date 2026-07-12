import { NextRequest } from "next/server";
import { rejectDocument } from "@/lib/documents";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    const { id } = await context.params;
    const body = await readBody(request);
    return successResponse(await rejectDocument(session, id, String(body.rejectedReason || body.message || "Dokument wurde abgelehnt.")));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
