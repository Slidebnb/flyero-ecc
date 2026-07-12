import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { addTicketMessage } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    return successResponse(await addTicketMessage(session, id, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
