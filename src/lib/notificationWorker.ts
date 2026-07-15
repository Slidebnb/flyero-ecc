import { ErrorSeverity, NotificationQueueStatus, SystemLogLevel } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { EmailResult, sendEmail } from "@/lib/email";
import {
  createErrorLog,
  createSystemLog,
  logBackgroundJobFailure,
  logBackgroundJobStart,
  logBackgroundJobSuccess,
} from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { productionNotificationQueueWhere } from "@/lib/productionData";

const MAX_PER_RUN = 50;
const MAX_ATTEMPTS = 3;

type QueueWithRelations = Awaited<ReturnType<typeof getQueueItem>>;

async function getQueueItem(queueId: string) {
  return prisma.notificationQueue.findFirst({
    where: { id: queueId, ...productionNotificationQueueWhere() },
    include: {
      message: true,
      user: { select: { id: true, email: true, role: true } },
      template: true,
    },
  });
}

function queuePayload(queue: NonNullable<QueueWithRelations>) {
  const payload = queue.payload && typeof queue.payload === "object" && !Array.isArray(queue.payload)
    ? queue.payload as Record<string, unknown>
    : {};

  return {
    subject: typeof payload.subject === "string" ? payload.subject : queue.message.subject,
    body: typeof payload.body === "string" ? payload.body : queue.message.body,
    data: payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : {},
  };
}

export async function markAsSent(queueId: string, result: Pick<EmailResult, "provider" | "messageId">) {
  const queue = await prisma.notificationQueue.update({
    where: { id: queueId },
    data: {
      status: NotificationQueueStatus.SENT,
      sentAt: new Date(),
      failedAt: null,
      lastError: null,
      provider: result.provider,
      providerMessageId: result.messageId,
    },
  });

  await prisma.notificationLog.create({
    data: {
      messageId: queue.messageId,
      queueId: queue.id,
      templateId: queue.templateId,
      userId: queue.userId,
      action: "email.sent",
      status: queue.status,
      detail: `Provider: ${result.provider}; Provider-ID: ${result.messageId}`,
    },
  });
  await createAuditLog({
    userId: queue.userId,
    action: "email.sent",
    entityType: "NotificationQueue",
    entityId: queue.id,
    newValues: { provider: result.provider, providerMessageId: result.messageId },
  });
  await createSystemLog({
    level: SystemLogLevel.INFO,
    source: "email.queue",
    message: "E-Mail versendet.",
    metadata: { queueId: queue.id, provider: result.provider, providerMessageId: result.messageId },
  });

  return queue;
}

export async function markAsFailed(queueId: string, error: unknown) {
  const existing = await prisma.notificationQueue.findFirst({ where: { id: queueId, ...productionNotificationQueueWhere() } });
  if (!existing) throw new Error("Queue-Eintrag wurde nicht gefunden.");

  const message = error instanceof Error ? error.message : String(error || "E-Mail Versand fehlgeschlagen.");
  const attempts = Math.min(existing.attempts + 1, MAX_ATTEMPTS);
  const status = attempts >= MAX_ATTEMPTS ? NotificationQueueStatus.FAILED : NotificationQueueStatus.RETRY;
  const queue = await prisma.notificationQueue.update({
    where: { id: queueId },
    data: {
      status,
      attempts,
      failedAt: new Date(),
      lastError: message,
      scheduledAt: status === NotificationQueueStatus.RETRY ? new Date(Date.now() + attempts * 60_000) : existing.scheduledAt,
    },
  });

  await prisma.notificationLog.create({
    data: {
      messageId: queue.messageId,
      queueId: queue.id,
      templateId: queue.templateId,
      userId: queue.userId,
      action: "email.failed",
      status: queue.status,
      detail: message,
      metadata: { attempts, maxAttempts: MAX_ATTEMPTS },
    },
  });
  await createAuditLog({
    userId: queue.userId,
    action: "email.failed",
    entityType: "NotificationQueue",
    entityId: queue.id,
    newValues: { error: message, attempts, status },
  });
  await createSystemLog({
    level: status === NotificationQueueStatus.FAILED ? SystemLogLevel.ERROR : SystemLogLevel.WARNING,
    source: "email.queue",
    message,
    metadata: { queueId: queue.id, attempts, status },
  });
  await createErrorLog({
    severity: attempts >= MAX_ATTEMPTS ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
    source: "email.queue",
    message,
    stack: error instanceof Error ? error.stack : undefined,
    metadata: { queueId: queue.id, attempts, status },
  });

  return queue;
}

export async function sendNotificationMessage(queueId: string) {
  const queue = await getQueueItem(queueId);
  if (!queue) throw new Error("Queue-Eintrag wurde nicht gefunden.");
  if (queue.channel !== "EMAIL") throw new Error("Nur E-Mail-Queue wird in Modul 18 verarbeitet.");
  const sendableStatuses: NotificationQueueStatus[] = [NotificationQueueStatus.PENDING, NotificationQueueStatus.RETRY];
  if (!sendableStatuses.includes(queue.status)) {
    return queue;
  }
  if (queue.attempts >= MAX_ATTEMPTS) {
    return markAsFailed(queue.id, new Error("Maximale Retry-Anzahl erreicht."));
  }

  const claim = await prisma.notificationQueue.updateMany({
    where: {
      id: queue.id,
      status: { in: sendableStatuses },
    },
    data: { status: NotificationQueueStatus.SENDING },
  });
  if (claim.count !== 1) {
    return (await getQueueItem(queue.id)) ?? queue;
  }

  try {
    const payload = queuePayload(queue);
    const result = await sendEmail({
      to: queue.recipientEmail ?? queue.user?.email ?? "",
      subject: payload.subject,
      text: payload.body,
      html: payload.body.includes("<") ? payload.body : undefined,
      metadata: {
        queueId: queue.id,
        messageId: queue.messageId,
        templateId: queue.templateId,
        type: queue.message.type,
        data: payload.data,
      },
    });
    return markAsSent(queue.id, result);
  } catch (error) {
    return markAsFailed(queue.id, error);
  }
}

export async function retryFailedNotification(queueId: string, userId?: string | null) {
  const queue = await prisma.notificationQueue.findFirst({ where: { id: queueId, ...productionNotificationQueueWhere() } });
  if (!queue) throw new Error("Queue-Eintrag wurde nicht gefunden.");
  if (queue.attempts >= MAX_ATTEMPTS) throw new Error("Maximale Retry-Anzahl erreicht.");

  const updated = await prisma.notificationQueue.update({
    where: { id: queueId },
    data: {
      status: NotificationQueueStatus.RETRY,
      scheduledAt: new Date(),
      lastError: null,
    },
  });

  await prisma.notificationLog.create({
    data: {
      messageId: updated.messageId,
      queueId: updated.id,
      templateId: updated.templateId,
      userId: updated.userId,
      action: "email.retry",
      status: updated.status,
      detail: "Retry wurde manuell vorgemerkt.",
    },
  });
  await createAuditLog({
    userId,
    action: "email.retry",
    entityType: "NotificationQueue",
    entityId: updated.id,
    newValues: { attempts: updated.attempts },
  });

  return sendNotificationMessage(updated.id);
}

export async function processPendingNotifications(input: { limit?: number; triggeredById?: string | null } = {}) {
  const limit = Math.min(input.limit ?? MAX_PER_RUN, MAX_PER_RUN);
  const job = await logBackgroundJobStart("NOTIFICATION_QUEUE", { limit, triggeredById: input.triggeredById ?? null });
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const queueFilter = {
      ...productionNotificationQueueWhere(),
      channel: "EMAIL" as const,
      status: { in: [NotificationQueueStatus.PENDING, NotificationQueueStatus.RETRY] },
      scheduledAt: { lte: new Date() },
    };
    const orderBy = [{ scheduledAt: "asc" as const }, { createdAt: "asc" as const }];
    const operationQueues = await prisma.notificationQueue.findMany({
      where: { ...queueFilter, userId: null, recipientEmail: { not: null } },
      orderBy,
      take: limit,
    });
    const remaining = limit - operationQueues.length;
    const regularQueues = remaining > 0
      ? await prisma.notificationQueue.findMany({
          where: {
            ...queueFilter,
            OR: [{ userId: { not: null } }, { recipientEmail: null }],
          },
          orderBy,
          take: remaining,
        })
      : [];
    const queues = [...operationQueues, ...regularQueues];

    for (const queue of queues) {
      processed += 1;
      const result = await sendNotificationMessage(queue.id);
      if (result.status === NotificationQueueStatus.SENT) sent += 1;
      if (result.status === NotificationQueueStatus.FAILED || result.status === NotificationQueueStatus.RETRY) failed += 1;
    }

    await prisma.notificationLog.create({
      data: {
        action: "notification.queue_processed",
        detail: `Queue verarbeitet: ${processed}, gesendet: ${sent}, fehlerhaft: ${failed}.`,
        metadata: { processed, sent, failed, limit },
      },
    });
    await createAuditLog({
      userId: input.triggeredById,
      action: "notification.queue_processed",
      entityType: "NotificationQueue",
      entityId: job.id,
      newValues: { processed, sent, failed, limit },
    });
    await logBackgroundJobSuccess(job.id, { processed, sent, failed, limit });

    return { processed, sent, failed, limit, jobId: job.id };
  } catch (error) {
    await logBackgroundJobFailure(job.id, error, { processed, sent, failed, limit });
    throw error;
  }
}

export const notificationWorkerLimits = {
  maxPerRun: MAX_PER_RUN,
  maxAttempts: MAX_ATTEMPTS,
};
