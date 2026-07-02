import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { previewNotificationTemplate } from "@/lib/notifications";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await params;
    const body = await readBody(request) as Record<string, unknown>;
    const data = typeof body.data === "object" && body.data ? body.data as Record<string, string> : body as Record<string, string>;
    const preview = await previewNotificationTemplate({ templateId: id, data, userId: session.id });
    return successResponse({ ...preview, testSendPrepared: true });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
