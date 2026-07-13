import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { closeTicket } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.SUPPORT_TICKET_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request);
    return successResponse(await closeTicket(session, id, typeof body.resolution === "string" ? body.resolution : undefined));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
