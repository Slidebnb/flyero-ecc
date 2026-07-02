import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { closeTicket } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const { id } = await context.params;
    const body = await readBody(request);
    return successResponse(await closeTicket(session, id, typeof body.resolution === "string" ? body.resolution : undefined));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
