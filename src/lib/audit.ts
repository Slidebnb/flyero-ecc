import { prisma } from "@/lib/prisma";
import { currentAuditRequestContext } from "@/lib/auditRequestContext";

export type AuditRequestContext = {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditInput = {
  userId?: string | null;
  tenantId?: string | null;
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
  const requestContext = input.requestContext ?? await currentAuditRequestContext();

  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValues: input.oldValues ?? undefined,
      newValues: input.newValues ?? undefined,
      metadata: input.metadata ?? undefined,
      requestId: requestContext?.requestId ?? undefined,
      ipAddress: requestContext?.ipAddress ?? undefined,
      userAgent: requestContext?.userAgent ?? undefined,
      result: input.result ?? "SUCCESS",
    },
  });
}
