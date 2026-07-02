import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    return successResponse(await listDocuments(session, Object.fromEntries(request.nextUrl.searchParams.entries())));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
