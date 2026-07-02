import { NextRequest } from "next/server";
import { NotificationAudience, NotificationChannel, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { extractPlaceholders } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

type Params = { params: Promise<{ id: string }> };

function enumValue<T extends Record<string, string>>(source: T, value: unknown, fallback: T[keyof T]) {
  return Object.values(source).includes(String(value)) ? (String(value) as T[keyof T]) : fallback;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await requireRole([UserRole.ADMIN]);
    const { id } = await params;
    const body = await readBody(request) as Record<string, unknown>;
    const before = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!before) return Response.json({ ok: false, error: "Vorlage wurde nicht gefunden." }, { status: 404 });
    const subject = String(body.subject ?? before.subject).trim();
    const templateBody = String(body.body ?? before.body).trim();
    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        key: String(body.key ?? before.key).trim(),
        audience: enumValue(NotificationAudience, body.audience ?? before.audience, before.audience),
        channel: enumValue(NotificationChannel, body.channel ?? before.channel, before.channel),
        name: String(body.name ?? before.name).trim(),
        description: String(body.description ?? before.description ?? "").trim() || null,
        subject,
        body: templateBody,
        placeholders: extractPlaceholders(subject, templateBody),
        isActive: body.isActive === undefined ? before.isActive : String(body.isActive) !== "false",
      },
    });
    await createAuditLog({
      userId: session.id,
      action: "template.updated",
      entityType: "NotificationTemplate",
      entityId: updated.id,
      oldValues: before,
      newValues: updated,
    });
    return successResponse(updated);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
