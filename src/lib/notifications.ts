import { ErrorSeverity, NotificationAudience, NotificationChannel, NotificationQueueStatus, UserRole } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { createErrorLog } from "@/lib/monitoring";
import { dispatchNotificationImmediately } from "@/lib/notificationWorker";
import { prisma } from "@/lib/prisma";
import { productionUserWhere } from "@/lib/productionData";

export const TEMPLATE_PLACEHOLDERS = [
  "customerName",
  "companyName",
  "orderNumber",
  "invoiceNumber",
  "reportNumber",
  "paymentAmount",
  "trackingUrl",
  "dashboardUrl",
  "supportEmail",
  "flyerQuantity",
  "areaName",
  "city",
  "postalCode",
  "netAmount",
  "vatAmount",
  "grossAmount",
  "paymentUrl",
  "invoiceUrl",
  "warehouseName",
  "warehouseAddress",
  "packageReference",
  "campaignUrl",
  "rejectionReason",
  "nextStep",
] as const;

type PlaceholderData = Record<string, string | number | boolean | null | undefined>;

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: PlaceholderData;
  templateKey?: string;
  channel?: NotificationChannel;
};

type OperationsNotificationInput = Omit<NotificationInput, "userId">;

export type TemplateInput = {
  key: string;
  audience: NotificationAudience;
  channel?: NotificationChannel;
  name: string;
  description?: string;
  subject: string;
  body: string;
  placeholders?: string[];
  isActive?: boolean;
};

export function inferAudience(role?: UserRole | null) {
  if (role === UserRole.CUSTOMER) return NotificationAudience.CUSTOMER;
  if (role === UserRole.DISTRIBUTOR) return NotificationAudience.DISTRIBUTOR;
  if (role === UserRole.ADMIN) return NotificationAudience.ADMIN;
  return NotificationAudience.INTERNAL;
}

export function renderTemplateText(template: string, data: PlaceholderData = {}) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function extractPlaceholders(...templates: string[]) {
  const placeholders = new Set<string>();
  for (const template of templates) {
    for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      placeholders.add(match[1]);
    }
  }
  return [...placeholders];
}

export async function upsertNotificationTemplate(input: TemplateInput, userId?: string) {
  const placeholders = input.placeholders ?? extractPlaceholders(input.subject, input.body);
  const existing = await prisma.notificationTemplate.findUnique({ where: { key: input.key } });
  const template = await prisma.notificationTemplate.upsert({
    where: { key: input.key },
    update: {
      audience: input.audience,
      channel: input.channel ?? NotificationChannel.EMAIL,
      name: input.name,
      description: input.description ?? null,
      subject: input.subject,
      body: input.body,
      placeholders,
      isActive: input.isActive ?? true,
    },
    create: {
      key: input.key,
      audience: input.audience,
      channel: input.channel ?? NotificationChannel.EMAIL,
      name: input.name,
      description: input.description,
      subject: input.subject,
      body: input.body,
      placeholders,
      isActive: input.isActive ?? true,
    },
  });

  if (userId && existing) {
    await createAuditLog({
      userId,
      action: "template.updated",
      entityType: "NotificationTemplate",
      entityId: template.id,
      oldValues: existing,
      newValues: template,
    });
  }

  return template;
}

export async function previewNotificationTemplate(input: { templateId: string; data: PlaceholderData; userId?: string }) {
  const template = await prisma.notificationTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw new Error("Vorlage wurde nicht gefunden.");
  const rendered = {
    subject: renderTemplateText(template.subject, input.data),
    body: renderTemplateText(template.body, input.data),
    placeholders: template.placeholders,
  };
  await prisma.notificationLog.create({
    data: {
      templateId: template.id,
      userId: input.userId,
      action: "template.previewed",
      detail: "Template-Vorschau wurde erzeugt.",
      metadata: { data: input.data },
    },
  });
  if (input.userId) {
    await createAuditLog({
      userId: input.userId,
      action: "template.previewed",
      entityType: "NotificationTemplate",
      entityId: template.id,
      newValues: rendered,
    });
  }
  return rendered;
}

async function preferenceAllows(userId: string, type: string, channel: NotificationChannel) {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_type_channel: { userId, type, channel } },
  });
  return preference?.enabled ?? true;
}

export async function createNotification(input: NotificationInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { role: true, tenantId: true } });
  const channel = input.channel ?? NotificationChannel.EMAIL;
  const inAppAllowed = await preferenceAllows(input.userId, input.type, NotificationChannel.IN_APP);
  const queueAllowed = await preferenceAllows(input.userId, input.type, channel);
  const template = input.templateKey
    ? await prisma.notificationTemplate.findUnique({ where: { key: input.templateKey } })
    : await prisma.notificationTemplate.findFirst({
        where: { key: input.type, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
  const data = input.data ?? {};
  const subject = template ? renderTemplateText(template.subject, { ...data, title: input.title }) : input.title;
  const body = template ? renderTemplateText(template.body, { ...data, message: input.message }) : input.message;
  const audience = template?.audience ?? inferAudience(user?.role);

  const message = await prisma.notificationMessage.create({
    data: {
      userId: input.userId,
      templateId: template?.id,
      type: input.type,
      audience,
      channel: NotificationChannel.IN_APP,
      subject,
      body,
      data,
    },
  });

  let legacyNotification = null;
  if (inAppAllowed) {
    legacyNotification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: subject,
        message: body,
      },
    });
  }

  let queue = null;
  if (queueAllowed) {
    queue = await prisma.notificationQueue.create({
      data: {
        messageId: message.id,
        templateId: template?.id,
        userId: input.userId,
        channel,
        status: NotificationQueueStatus.PENDING,
        payload: { subject, body, data },
      },
    });
  }

  await prisma.notificationLog.create({
    data: {
      messageId: message.id,
      queueId: queue?.id,
      templateId: template?.id,
      userId: input.userId,
      action: "notification.created",
      status: queue?.status,
      detail: queueAllowed ? "Nachricht wurde erstellt und für Versand vorgemerkt." : "Nachricht wurde erstellt, Versand laut Preference deaktiviert.",
      metadata: { type: input.type, channel, legacyNotificationId: legacyNotification?.id ?? null },
    },
  });
  await createAuditLog({
    userId: input.userId,
    tenantId: user?.tenantId ?? null,
    action: "notification.created",
    entityType: "NotificationMessage",
    entityId: message.id,
    newValues: { type: input.type, channel, queueId: queue?.id ?? null },
  });

  return { message, queue, notification: legacyNotification };
}

function operationsEmail() {
  return (process.env.OPERATIONS_EMAIL || "hallo@flyero.org").trim().toLowerCase();
}

function operationsDetails(data: PlaceholderData) {
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join("\n");
}

export async function notifyOperations(input: OperationsNotificationInput) {
  // Die Betriebsadresse bekommt immer eine E-Mail-Kopie, auch wenn die
  // zugehoerige interne Benachrichtigung einen anderen Kanal verwendet.
  const channel = NotificationChannel.EMAIL;
  const template = input.templateKey
    ? await prisma.notificationTemplate.findUnique({ where: { key: input.templateKey } })
    : await prisma.notificationTemplate.findFirst({
        where: { key: input.type, isActive: true },
        orderBy: { updatedAt: "desc" },
      });
  const data = input.data ?? {};
  const subject = template ? renderTemplateText(template.subject, { ...data, title: input.title }) : input.title;
  const baseBody = template ? renderTemplateText(template.body, { ...data, message: input.message }) : input.message;
  const details = operationsDetails(data);
  const body = details ? `${baseBody}\n\nVollständige Vorgangsdaten:\n${details}` : baseBody;
  const recipient = operationsEmail();
  const message = await prisma.notificationMessage.create({
    data: {
      templateId: template?.id,
      type: input.type,
      audience: NotificationAudience.INTERNAL,
      channel: NotificationChannel.IN_APP,
      subject,
      body,
      data,
    },
  });
  const queue = channel === NotificationChannel.EMAIL
    ? await prisma.notificationQueue.create({
        data: {
          messageId: message.id,
          templateId: template?.id,
          recipientEmail: recipient,
          channel,
          status: NotificationQueueStatus.PENDING,
          payload: { subject, body, data },
        },
      })
    : null;
  await prisma.notificationLog.create({
    data: {
      messageId: message.id,
      queueId: queue?.id,
      templateId: template?.id,
      action: "operations.notification.created",
      status: queue?.status,
      detail: `Betriebsbenachrichtigung fuer ${recipient} vorgemerkt.`,
      metadata: { type: input.type, channel, recipientEmail: recipient },
    },
  });
  const dispatchedQueue = await dispatchNotificationImmediately(queue?.id);
  return { message, queue: dispatchedQueue ?? queue };
}

export async function notifyEmailRecipient(input: {
  recipientEmail: string;
  type: string;
  subject: string;
  body: string;
  data?: PlaceholderData;
}) {
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  const message = await prisma.notificationMessage.create({
    data: {
      type: input.type,
      audience: NotificationAudience.CUSTOMER,
      channel: NotificationChannel.IN_APP,
      subject: input.subject,
      body: input.body,
      data: input.data ?? {},
    },
  });
  const queue = await prisma.notificationQueue.create({
    data: {
      messageId: message.id,
      recipientEmail,
      channel: NotificationChannel.EMAIL,
      status: NotificationQueueStatus.PENDING,
      payload: { subject: input.subject, body: input.body, data: input.data ?? {} },
    },
  });
  await prisma.notificationLog.create({
    data: {
      messageId: message.id,
      queueId: queue.id,
      action: "customer.email.queued",
      status: queue.status,
      detail: `KundenbestÃ¤tigung fÃ¼r ${recipientEmail} vorgemerkt.`,
      metadata: { type: input.type, recipientEmail },
    },
  });
  const dispatchedQueue = await dispatchNotificationImmediately(queue.id);
  return { message, queue: dispatchedQueue ?? queue };
}

export async function notifyAdmins(input: Omit<NotificationInput, "userId">) {
  const admins = await prisma.user.findMany({
    where: { ...productionUserWhere(), role: { in: [UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER] } },
    select: { id: true },
  });

  // Die zentrale Betriebsadresse wird sofort parallel zum Erzeugen der
  // In-App/Admin-Nachrichten versorgt. So hängt der wichtige Lead-Hinweis
  // nicht von der Anzahl oder Laufzeit weiterer Admin-Benachrichtigungen ab.
  const [operationsNotification, adminNotifications] = await Promise.all([
    notifyOperations(input),
    Promise.all(admins.map((admin) => createNotification({ userId: admin.id, ...input }))),
  ]);
  return [...adminNotifications, { message: operationsNotification.message, queue: operationsNotification.queue, notification: null }];
}

export async function markNotificationQueueSent(queueId: string, providerMessageId?: string) {
  const queue = await prisma.notificationQueue.update({
    where: { id: queueId },
    data: { status: NotificationQueueStatus.SENT, sentAt: new Date(), providerMessageId },
  });
  await prisma.notificationLog.create({
    data: {
      messageId: queue.messageId,
      queueId: queue.id,
      templateId: queue.templateId,
      userId: queue.userId,
      action: "notification.sent",
      status: queue.status,
    },
  });
  await createAuditLog({
    userId: queue.userId,
    action: "notification.sent",
    entityType: "NotificationQueue",
    entityId: queue.id,
  });
  return queue;
}

export async function markNotificationQueueFailed(queueId: string, error: string) {
  const queue = await prisma.notificationQueue.update({
    where: { id: queueId },
    data: {
      status: NotificationQueueStatus.FAILED,
      failedAt: new Date(),
      attempts: { increment: 1 },
      lastError: error,
    },
  });
  await prisma.notificationLog.create({
    data: {
      messageId: queue.messageId,
      queueId: queue.id,
      templateId: queue.templateId,
      userId: queue.userId,
      action: "notification.failed",
      status: queue.status,
      detail: error,
    },
  });
  await createAuditLog({
    userId: queue.userId,
    action: "notification.failed",
    entityType: "NotificationQueue",
    entityId: queue.id,
    newValues: { error },
  });
  await createErrorLog({
    severity: ErrorSeverity.MEDIUM,
    source: "notification.queue",
    message: error,
    metadata: { queueId: queue.id, userId: queue.userId, channel: queue.channel },
  });
  return queue;
}
