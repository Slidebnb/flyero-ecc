import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createDocument, listDocuments } from "@/lib/documents";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const documents = await listDocuments(session, Object.fromEntries(request.nextUrl.searchParams.entries()));
    return successResponse(documents);
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const document = await createDocument(session, await readBody(request));
    return successResponse(document, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
