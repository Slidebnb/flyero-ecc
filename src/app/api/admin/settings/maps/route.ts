import { Permission, requirePermission } from "@/lib/permissions";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { getGoogleMapsConfigStatus } from "@/lib/settings";

export async function GET() {
  try {
    await requirePermission(Permission.PLATFORM_SETTINGS_MANAGE);
    return successResponse(await getGoogleMapsConfigStatus());
  } catch (error) {
    return routeErrorResponse(error);
  }
}
