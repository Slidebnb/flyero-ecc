export function allowedTenantRolesForUserRole(role: string): string[] {
  if (role === "SUPPORT_DISPATCHER") return ["SUPPORT", "DISPATCHER", "OWNER", "ADMIN"];
  if (role === "WAREHOUSE_STAFF") return ["WAREHOUSE", "OWNER", "ADMIN"];
  if (role === "DISTRIBUTOR") return ["DISTRIBUTOR", "OWNER", "ADMIN"];
  if (role === "CUSTOMER") return ["OWNER", "ADMIN"];
  return [];
}

export function tenantScopeMatches(session: { role: string; tenantId?: string | null }, tenantId: string) {
  return session.role === "ADMIN" || Boolean(session.tenantId && session.tenantId === tenantId);
}
