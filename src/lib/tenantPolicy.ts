import { TenantMembershipStatus, UserRole } from "@prisma/client";
import { AuthError, type SessionPayload } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allowedTenantRolesForUserRole, tenantScopeMatches } from "@/lib/tenantPolicyLogic";

export { allowedTenantRolesForUserRole, tenantScopeMatches } from "@/lib/tenantPolicyLogic";

type TenantScopedSession = Pick<SessionPayload, "id" | "role" | "tenantId">;

export async function requireActiveTenantMembership(session: TenantScopedSession, requestedTenantId = session.tenantId) {
  if (session.role === UserRole.ADMIN) return null;
  if (!requestedTenantId || !tenantScopeMatches(session, requestedTenantId)) {
    throw new AuthError("Kein Zugriff auf diesen Unternehmensbereich.", 403);
  }
  const membership = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId: requestedTenantId, userId: session.id } },
    select: { tenantId: true, role: true, status: true },
  });
  if (!membership || membership.status !== TenantMembershipStatus.ACTIVE || !allowedTenantRolesForUserRole(session.role).includes(membership.role)) {
    throw new AuthError("Deine Unternehmensberechtigung ist nicht aktiv.", 403);
  }
  return membership;
}

export function tenantWhereForSession(session: TenantScopedSession) {
  if (session.role === UserRole.ADMIN) return {};
  if (!session.tenantId) throw new AuthError("Dein Konto ist keinem Unternehmen zugeordnet.", 403);
  return { tenantId: session.tenantId };
}
