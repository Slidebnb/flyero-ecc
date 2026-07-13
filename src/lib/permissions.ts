import { UserRole } from "@prisma/client";
import { AuthError, requireSession, type SessionPayload } from "@/lib/auth";
import { requireActiveTenantMembership } from "@/lib/tenantPolicy";

export const Permission = {
  ACCOUNTING_EXPORT: "accounting.export",
  ACCOUNTING_EXPORT_DOWNLOAD: "accounting.export.download",
  ACCOUNTING_EXPORT_ARCHIVE: "accounting.export.archive",
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",
  ORDER_VIEW: "order.view",
  ORDER_MANAGE: "order.manage",
  DISPATCH_ASSIGN: "dispatch.assign",
  DOCUMENT_REVIEW: "document.review",
  DOCUMENT_SCAN: "document.scan",
  INVOICE_VIEW: "invoice.view",
  INVOICE_ADMIN_VIEW: "invoice.admin.view",
  INVOICE_MANAGE: "invoice.manage",
  INTERNAL_USERS_MANAGE: "internal-users.manage",
  PAYMENT_VIEW: "payment.view",
  PAYMENT_REFUND: "payment.refund",
  PAYMENT_RECONCILE: "payment.reconcile",
  PAYMENT_DISPUTE_MANAGE: "payment.dispute.manage",
  PRICING_MANAGE: "pricing.manage",
  REPORT_REVIEW: "report.review",
  REPORT_PUBLISH: "report.publish",
  SUPPORT_TICKET_VIEW: "support.ticket.view",
  SUPPORT_TICKET_MANAGE: "support.ticket.manage",
  WAREHOUSE_VIEW: "warehouse.view",
  WAREHOUSE_MANAGE: "warehouse.manage",
  PRINT_PARTNER_VIEW: "print-partner.view",
  PRINT_PARTNER_MANAGE: "print-partner.manage",
  PRINT_ORDER_VIEW: "print-order.view",
  PRINT_ORDER_MANAGE: "print-order.manage",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ADMIN_PERMISSIONS: readonly Permission[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.SUPPORT_DISPATCHER]: [
    Permission.ANALYTICS_VIEW,
    Permission.DISPATCH_ASSIGN,
    Permission.DOCUMENT_REVIEW,
    Permission.INVOICE_VIEW,
    Permission.REPORT_REVIEW,
    Permission.SUPPORT_TICKET_VIEW,
    Permission.SUPPORT_TICKET_MANAGE,
    Permission.WAREHOUSE_VIEW,
    Permission.PRINT_PARTNER_VIEW,
    Permission.PRINT_ORDER_VIEW,
    Permission.PRINT_ORDER_MANAGE,
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
  await requireActiveTenantMembership(session);
  return session;
}
