import { NextRequest } from "next/server";
import { NotificationAudience, NotificationChannel } from "@prisma/client";
import { Permission, requirePermission } from "@/lib/permissions";
import { extractPlaceholders, upsertNotificationTemplate } from "@/lib/notifications";
import { readBody, routeErrorResponse, successResponse } from "@/lib/request";

function enumValue<T extends Record<string, string>>(source: T, value: unknown, fallback: T[keyof T]) {
  return Object.values(source).includes(String(value)) ? (String(value) as T[keyof T]) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(Permission.TEMPLATE_MANAGE);
    const body = await readBody(request) as Record<string, unknown>;
    const subject = String(body.subject ?? "").trim();
    const templateBody = String(body.body ?? "").trim();
    const template = await upsertNotificationTemplate({
      key: String(body.key ?? "").trim(),
      audience: enumValue(NotificationAudience, body.audience, NotificationAudience.INTERNAL),
      channel: enumValue(NotificationChannel, body.channel, NotificationChannel.EMAIL),
      name: String(body.name ?? "").trim(),
      description: String(body.description ?? "").trim() || undefined,
      subject,
      body: templateBody,
      placeholders: extractPlaceholders(subject, templateBody),
      isActive: body.isActive === undefined ? true : String(body.isActive) !== "false",
    }, session.id);
    return successResponse(template, 201);
  } catch (error) {
    return routeErrorResponse(error);
  }
}
