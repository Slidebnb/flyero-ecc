import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { listInternalUsers } from "@/lib/settings";

export async function GET() {
  try {
    await requirePermission(Permission.INTERNAL_USERS_MANAGE);
    return successResponse(await listInternalUsers());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
