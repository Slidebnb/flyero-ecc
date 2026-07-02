import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET() {
  try {
    const session = await requireRole([UserRole.CUSTOMER]);
    const [messages, preferences] = await Promise.all([
      prisma.notificationMessage.findMany({
        where: { userId: session.id },
        include: { template: true, queues: { orderBy: { createdAt: "desc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notificationPreference.findMany({
        where: { userId: session.id },
        orderBy: [{ type: "asc" }, { channel: "asc" }],
      }),
    ]);
    return successResponse({ messages, preferences });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
