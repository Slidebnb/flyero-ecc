import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { listTickets, parseTicketFilters } from "@/lib/support";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { createTicket } from "@/lib/support";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const filters = parseTicketFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const tickets = await listTickets(session, filters);
    return successResponse({ filters, tickets });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const ticket = await createTicket(session, await readBody(request));
    return successResponse(ticket, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
