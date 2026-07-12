import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createTicket, listTickets, parseTicketFilters } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const filters = parseTicketFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return successResponse({ filters, tickets: await listTickets(session, filters) });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    return successResponse(await createTicket(session, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
