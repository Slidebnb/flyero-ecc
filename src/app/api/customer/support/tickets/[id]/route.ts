import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getTicket } from "@/lib/support";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const { id } = await context.params;
    return successResponse(await getTicket(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
