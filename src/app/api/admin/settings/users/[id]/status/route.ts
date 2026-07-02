import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { setInternalUserStatus } from "@/lib/settings";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await context.params;
    const body = await readBody(request) as Record<string, unknown>;
    const status = String(body.status ?? UserStatus.ACTIVE) as UserStatus;
    return successResponse(await setInternalUserStatus({ userId: id, status, adminUserId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
