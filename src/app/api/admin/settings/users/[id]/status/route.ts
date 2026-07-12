import { NextRequest } from "next/server";
import { UserStatus } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";
import { setInternalUserStatus } from "@/lib/settings";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission(Permission.INTERNAL_USERS_MANAGE);
    const { id } = await context.params;
    const body = await readBody(request) as Record<string, unknown>;
    const status = String(body.status ?? UserStatus.ACTIVE) as UserStatus;
    return successResponse(await setInternalUserStatus({ userId: id, status, adminUserId: session.id }));
  } catch (error) {
    return routeErrorResponse(error);
  }
}
