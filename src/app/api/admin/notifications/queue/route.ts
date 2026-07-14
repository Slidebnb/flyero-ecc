import { NotificationQueueStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getEmailProviderStatus } from "@/lib/email";
import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { productionUserWhere } from "@/lib/productionData";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.NOTIFICATION_OPERATIONS_VIEW);
    const status = request.nextUrl.searchParams.get("status");
    const statusWhere = status && Object.values(NotificationQueueStatus).includes(status as NotificationQueueStatus)
      ? { status: status as NotificationQueueStatus }
      : {};
    const [queues, countRows] = await Promise.all([
      prisma.notificationQueue.findMany({
        where: { ...statusWhere, user: productionUserWhere() },
        include: {
          user: { select: { email: true, role: true } },
          template: { select: { key: true, name: true } },
          message: { select: { subject: true, type: true } },
        },
        orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
        take: 200,
      }),
      prisma.notificationQueue.findMany({ where: { user: productionUserWhere() }, select: { status: true } }),
    ]);
    const counts = Object.values(NotificationQueueStatus).map((queueStatus) => ({
      status: queueStatus,
      _count: { status: countRows.filter((item) => item.status === queueStatus).length },
    }));

    return successResponse({
      queues,
      counts,
      provider: getEmailProviderStatus(),
    });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
