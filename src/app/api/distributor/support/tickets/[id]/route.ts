import { NextRequest } from "next/server";
import { Permission, requirePermission } from "@/lib/permissions";
import { getTicket } from "@/lib/support";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requirePermission(Permission.DISTRIBUTOR_SUPPORT_VIEW);
    const { id } = await context.params;
    return successResponse(await getTicket(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
