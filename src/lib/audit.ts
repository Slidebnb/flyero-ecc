import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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

function stableValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === "object") {
    if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
      return stableValue((value as { toJSON: () => unknown }).toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return String(value);
}

type AuditRowData = {
  userId: string | null;
  tenantId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
  metadata?: unknown;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  result: string;
};

function toPrismaJson(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function createAuditIntegrityHash(input: {
  id: string;
  createdAt: Date;
  previousIntegrityHash: string | null;
  data: AuditRowData;
}) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue({
      id: input.id,
      createdAt: input.createdAt.toISOString(),
      previousIntegrityHash: input.previousIntegrityHash,
      data: input.data,
    })))
    .digest("hex");
}

async function persistAuditRow(data: AuditRowData) {
  return prisma.$transaction(async (tx) => {
    // Serialize writers so concurrent requests cannot silently fork the chain.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(441337);`;
    const previous = await tx.auditLog.findFirst({
      where: { integrityHash: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { integrityHash: true },
    });
    const id = randomUUID();
    const createdAt = new Date();
    const previousIntegrityHash = previous?.integrityHash ?? null;
    const integrityHash = createAuditIntegrityHash({ id, createdAt, previousIntegrityHash, data });
    return tx.auditLog.create({
      data: {
        id,
        ...data,
        oldValues: toPrismaJson(data.oldValues),
        newValues: toPrismaJson(data.newValues),
        metadata: toPrismaJson(data.metadata),
        previousIntegrityHash,
        integrityHash,
        createdAt,
      },
    });
  });
}

export async function createAuditLog(input: AuditInput) {
  const requestContext = input.requestContext ?? await currentAuditRequestContext();
  const data: AuditRowData = {
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
    await persistAuditRow(data);
  } catch (error) {
    // A revoked session can outlive a deleted user or tenant. The business action
    // must still finish, while the audit event remains traceable without that FK.
    if (!isForeignKeyViolation(error) || (!data.userId && !data.tenantId)) throw error;
    await persistAuditRow({ ...data, userId: null, tenantId: undefined });
  }
}

export async function verifyAuditLogIntegrity() {
  const entries = await prisma.auditLog.findMany({
    where: { integrityHash: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      tenantId: true,
      action: true,
      entityType: true,
      entityId: true,
      oldValues: true,
      newValues: true,
      metadata: true,
      requestId: true,
      ipAddress: true,
      userAgent: true,
      result: true,
      createdAt: true,
      previousIntegrityHash: true,
      integrityHash: true,
    },
  });
  const knownHashes = new Set<string>();
  for (const entry of entries) {
    if (!entry.integrityHash) {
      return { ok: false, checked: entries.indexOf(entry), reason: "hash_missing", entryId: entry.id };
    }
    if (entry.previousIntegrityHash && !knownHashes.has(entry.previousIntegrityHash)) {
      return { ok: false, checked: entries.indexOf(entry), reason: "previous_hash_missing", entryId: entry.id };
    }
    const expected = createAuditIntegrityHash({
      id: entry.id,
      createdAt: entry.createdAt,
      previousIntegrityHash: entry.previousIntegrityHash,
      data: {
        userId: entry.userId,
        tenantId: entry.tenantId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        metadata: entry.metadata,
        requestId: entry.requestId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        result: entry.result,
      },
    });
    if (expected !== entry.integrityHash) {
      return { ok: false, checked: entries.indexOf(entry), reason: "hash_mismatch", entryId: entry.id };
    }
    knownHashes.add(entry.integrityHash);
  }
  return { ok: true, checked: entries.length };
}
