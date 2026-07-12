import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createDocument, listDocuments } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    return successResponse(await listDocuments(session, { orderId: id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireTenantSession();
    const { id } = await context.params;
    const body = await readBody(request);
    return successResponse(await createDocument(session, { ...body, orderId: id }), 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
