import { NextRequest } from "next/server";
import { requireTenantSession } from "@/lib/tenant";
import { createDocument, listDocuments } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const documents = await listDocuments(session, Object.fromEntries(request.nextUrl.searchParams.entries()));
    return successResponse(documents);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const document = await createDocument(session, await readBody(request));
    return successResponse(document, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
