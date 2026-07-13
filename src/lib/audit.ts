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

function isForeignKeyViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2003");
}

export async function createAuditLog(input: AuditInput) {
  const requestContext = input.requestContext ?? await currentAuditRequestContext();
  const data = {
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
  };

  try {
    await prisma.auditLog.create({ data });
  } catch (error) {
    // A revoked session can outlive a deleted user or tenant. The business action
    // must still finish, while the audit event remains traceable without that FK.
    if (!isForeignKeyViolation(error) || (!data.userId && !data.tenantId)) throw error;
    await prisma.auditLog.create({ data: { ...data, userId: null, tenantId: undefined } });
  }
}
