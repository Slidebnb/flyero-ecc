import { Prisma, UserRole } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth";

export type LeadScope = {
  tenantId: string | null;
  isGlobalAdmin: boolean;
};

export function leadScopeFromSession(session: Pick<SessionPayload, "role" | "tenantId">): LeadScope {
  return {
    tenantId: session.tenantId ?? null,
    isGlobalAdmin: session.role === UserRole.ADMIN,
  };
}

/** Public leads remain unassigned until they are converted into a customer tenant. */
export function leadScopeWhere(scope: LeadScope): Prisma.LeadWhereInput {
  if (scope.isGlobalAdmin) return {};
  if (!scope.tenantId) return { tenantId: null };
  return {
    OR: [
      { tenantId: scope.tenantId },
      { tenantId: null },
    ],
  };
}
