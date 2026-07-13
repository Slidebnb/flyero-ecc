import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { getTicket, updateTicket } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.SUPPORT_TICKET_VIEW);
    const { id } = await context.params;
    return successResponse(await getTicket(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.SUPPORT_TICKET_MANAGE);
    const { id } = await context.params;
    return successResponse(await updateTicket(session, id, await readBody(request)));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
