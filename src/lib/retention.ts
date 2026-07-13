import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const retentionHoldSchema = z.object({
  orderId: z.string().cuid("Auftrag ist ungueltig."),
  reason: z.string().trim().min(3, "Ein Grund ist erforderlich.").max(500, "Der Grund ist zu lang."),
  caseReference: z.string().trim().max(160, "Das Aktenzeichen ist zu lang.").nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export function activeRetentionHoldWhere(now = new Date()) {
  return {
    releasedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export async function hasActiveRetentionHold(orderId: string, now = new Date()) {
  const hold = await prisma.retentionHold.findFirst({
    where: { orderId, ...activeRetentionHoldWhere(now) },
    select: { id: true },
  });
  return Boolean(hold);
}

export async function createRetentionHold(input: {
  orderId: string;
  reason: string;
  caseReference?: string | null;
  expiresAt?: Date | null;
  createdById: string;
  tenantId: string;
}) {
  const hold = await prisma.retentionHold.create({
    data: {
      orderId: input.orderId,
      tenantId: input.tenantId,
      reason: input.reason,
      caseReference: input.caseReference ?? null,
      expiresAt: input.expiresAt ?? null,
      createdById: input.createdById,
    },
  });

  await createAuditLog({
    userId: input.createdById,
    tenantId: input.tenantId,
    action: "retention_hold.created",
    entityType: "RetentionHold",
    entityId: hold.id,
    newValues: {
      orderId: hold.orderId,
      reason: hold.reason,
      caseReference: hold.caseReference,
      expiresAt: hold.expiresAt,
    },
  });

  return hold;
}
