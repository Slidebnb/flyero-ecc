import { NotificationQueueStatus, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { getEmailProviderStatus } from "@/lib/email";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";

export async function GET(request: NextRequest) {
  try {
    await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const status = request.nextUrl.searchParams.get("status");
    const where = status && Object.values(NotificationQueueStatus).includes(status as NotificationQueueStatus)
      ? { status: status as NotificationQueueStatus }
      : {};
    const [queues, counts] = await Promise.all([
      prisma.notificationQueue.findMany({
        where,
        include: {
          user: { select: { email: true, role: true } },
          template: { select: { key: true, name: true } },
          message: { select: { subject: true, type: true } },
        },
        orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
        take: 200,
      }),
      prisma.notificationQueue.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

    return successResponse({
      queues,
      counts,
      provider: getEmailProviderStatus(),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
