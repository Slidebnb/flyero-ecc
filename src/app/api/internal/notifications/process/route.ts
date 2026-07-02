import { processPendingNotifications } from "@/lib/notificationWorker";
import { errorResponse, successResponse } from "@/lib/request";

export async function POST(request: Request) {
  const token = request.headers.get("x-internal-token");
  if (!process.env.INTERNAL_API_TOKEN || token !== process.env.INTERNAL_API_TOKEN) {
    return errorResponse("Interner Zugriff nicht erlaubt.", 403);
  }

  const result = await processPendingNotifications();
  return successResponse(result);
}
