import { Prisma, TenantMembershipStatus, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthError, requireRole, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createCustomerTenant(tx: Prisma.TransactionClient, name: string) {
  return tx.tenant.create({
    data: {
      name: name.trim(),
      slug: `customer-${randomUUID()}`,
      status: "ACTIVE",
    },
  });
}

export async function requireTenantSession(): Promise<SessionPayload & { tenantId: string }> {
  const session = await requireRole([UserRole.CUSTOMER]);
  if (!session.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);

  const membership = await prisma.tenantMembership.findFirst({
    where: { tenantId: session.tenantId, userId: session.id, status: TenantMembershipStatus.ACTIVE },
    select: { tenantId: true },
  });
  if (!membership) throw new AuthError("Dein Unternehmenszugang ist nicht aktiv.", 403);
  return { ...session, tenantId: membership.tenantId };
}
