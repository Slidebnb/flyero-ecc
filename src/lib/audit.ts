import { prisma } from "@/lib/prisma";

export type AuditRequestContext = {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
  requestContext?: AuditRequestContext | null;
  result?: string;
};

export async function createAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      metadata: input.metadata ?? undefined,
      requestId: input.requestContext?.requestId ?? undefined,
      ipAddress: input.requestContext?.ipAddress ?? undefined,
      userAgent: input.requestContext?.userAgent ?? undefined,
      result: input.result ?? "SUCCESS",
    },
  });
}
