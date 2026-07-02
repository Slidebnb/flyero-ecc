import { ErrorSeverity, NotificationChannel, NotificationQueueStatus, SystemLogLevel, UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { createErrorLogFromUnknown, createSystemLog } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { errorResponse, readBody, routeErrorResponse, successResponse } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([UserRole.ADMIN, UserRole.SUPPORT_DISPATCHER]);
    const body = (await readBody(request)) as Record<string, unknown>;
    const recipient = typeof body.recipient === "string" ? body.recipient.trim() : "";
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const subjectInput = typeof body.subject === "string" ? body.subject.trim() : "";
    const textInput = typeof body.text === "string" ? body.text.trim() : "";

    if (!recipient || !recipient.includes("@")) return errorResponse("Empfänger ist ungültig.", 400);

    const template = templateId
      ? await prisma.notificationTemplate.findUnique({ where: { id: templateId } })
      : null;
    const subject = template?.subject || subjectInput || "FLYERO Test-E-Mail";
    const text = template?.body || textInput || "Das ist eine FLYERO Test-E-Mail.";

    const adminMessage = await prisma.notificationMessage.create({
      data: {
        userId: session.id,
        templateId: template?.id,
        type: "EMAIL_TEST",
        audience: "ADMIN",
        channel: NotificationChannel.IN_APP,
        subject,
        body: text,
        data: { recipient },
      },
    });
    const queue = await prisma.notificationQueue.create({
      data: {
        messageId: adminMessage.id,
        templateId: template?.id,
        userId: session.id,
        channel: NotificationChannel.EMAIL,
        status: NotificationQueueStatus.SENDING,
        payload: { subject, body: text, recipient, test: true },
      },
    });

    const result = await sendEmail({
      to: recipient,
      subject,
      text,
      metadata: { test: true, queueId: queue.id, triggeredById: session.id },
    });

    const sent = await prisma.notificationQueue.update({
      where: { id: queue.id },
      data: {
        status: NotificationQueueStatus.SENT,
        sentAt: new Date(),
        providerMessageId: result.messageId,
      },
    });
    await prisma.notificationLog.create({
      data: {
        messageId: adminMessage.id,
        queueId: sent.id,
        templateId: template?.id,
        userId: session.id,
        action: "email.test_sent",
        status: sent.status,
        detail: `Test-E-Mail an ${recipient}`,
        metadata: { provider: result.provider, providerMessageId: result.messageId },
      },
    });
    await createAuditLog({
      userId: session.id,
      action: "email.test_sent",
      entityType: "NotificationQueue",
      entityId: sent.id,
      newValues: { recipient, provider: result.provider },
    });
    await createSystemLog({
      level: SystemLogLevel.INFO,
      source: "email.test",
      message: `Test-E-Mail an ${recipient}`,
      metadata: { queueId: sent.id, provider: result.provider },
    });

    return successResponse({ queueId: sent.id, provider: result.provider, messageId: result.messageId }, 201);
  } catch (error) {
    await createErrorLogFromUnknown(error, {
      severity: ErrorSeverity.MEDIUM,
      source: "email.test",
      fallbackMessage: "Test-E-Mail fehlgeschlagen.",
    });
    return routeErrorResponse(error);
  }
}
