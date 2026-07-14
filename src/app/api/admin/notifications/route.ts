import { Permission, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { routeErrorResponse, successResponse } from "@/lib/request";
import { productionNotificationLogWhere, productionNotificationMessageWhere, productionNotificationQueueWhere, productionUserWhere } from "@/lib/productionData";

export async function GET() {
  try {
    await requirePermission(Permission.NOTIFICATION_OPERATIONS_VIEW);
    const [messages, queues, templates, logs, preferences] = await Promise.all([
      prisma.notificationMessage.findMany({
        where: { audience: { in: ["ADMIN", "INTERNAL"] }, ...productionNotificationMessageWhere(), user: productionUserWhere() },
        include: { user: { select: { email: true, role: true } }, template: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.notificationQueue.findMany({
        where: productionNotificationQueueWhere(),
        include: { user: { select: { email: true, role: true } }, template: true },
        orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
        take: 200,
      }),
      prisma.notificationTemplate.findMany({ orderBy: [{ audience: "asc" }, { name: "asc" }] }),
      prisma.notificationLog.findMany({
        where: productionNotificationLogWhere(),
        include: { user: { select: { email: true } }, template: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.notificationPreference.findMany({
        where: { user: productionUserWhere() },
        include: { user: { select: { email: true, role: true } } },
        orderBy: [{ userId: "asc" }, { type: "asc" }],
        take: 200,
      }),
    ]);
    return successResponse({ messages, queues, templates, logs, preferences });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
