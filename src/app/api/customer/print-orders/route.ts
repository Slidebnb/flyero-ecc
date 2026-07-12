import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createPrintOrder, listPrintOrders } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireTenantSession();
    return successResponse(await listPrintOrders(session));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    return successResponse(await createPrintOrder(session, await readBody(request)), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
