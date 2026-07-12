import { NextRequest } from "next/server";
import { listDocuments } from "@/lib/documents";
import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.DOCUMENT_REVIEW);
    return successResponse(await listDocuments(session, Object.fromEntries(request.nextUrl.searchParams.entries())));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
