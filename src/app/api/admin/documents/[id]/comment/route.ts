import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { addDocumentComment } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    return successResponse(await addDocumentComment(session, id, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
