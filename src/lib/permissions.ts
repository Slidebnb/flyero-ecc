import { UserRole } from "@prisma/client";
import { AuthError, requireSession, type SessionPayload } from "@/lib/auth";

export const Permission = {
  ACCOUNTING_EXPORT: "accounting.export",
  ACCOUNTING_EXPORT_DOWNLOAD: "accounting.export.download",
  ACCOUNTING_EXPORT_ARCHIVE: "accounting.export.archive",
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",
  DOCUMENT_REVIEW: "document.review",
  INTERNAL_USERS_MANAGE: "internal-users.manage",
  PAYMENT_REFUND: "payment.refund",
  PAYMENT_RECONCILE: "payment.reconcile",
  PAYMENT_DISPUTE_MANAGE: "payment.dispute.manage",
  PRICING_MANAGE: "pricing.manage",
  REPORT_REVIEW: "report.review",
  REPORT_PUBLISH: "report.publish",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ADMIN_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.SUPPORT_DISPATCHER]: [
    Permission.ANALYTICS_VIEW,
    Permission.DOCUMENT_REVIEW,
    Permission.REPORT_REVIEW,
  ],
  [UserRole.WAREHOUSE_STAFF]: [],
  [UserRole.DISTRIBUTOR]: [],
  [UserRole.CUSTOMER]: [],
};

export function hasPermission(session: Pick<SessionPayload, "role"> | null, permission: Permission) {
  return Boolean(session && ROLE_PERMISSIONS[session.role]?.includes(permission));
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!hasPermission(session, permission)) {
    throw new AuthError("Keine Berechtigung für diese Aktion.", 403);
  }
  return session;
}
