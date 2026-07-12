import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { getTicket } from "@/lib/support";
import { routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    return successResponse(await getTicket(session, id));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
