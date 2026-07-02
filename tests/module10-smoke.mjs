import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function includes(filePath, snippets) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
  const content = await readFile(filePath, "utf8");
  for (const snippet of snippets) {
    assert(content.includes(snippet), `${filePath} enthaelt nicht: ${snippet}`);
  }
  return content;
}

await includes("prisma/schema.prisma", [
  "model Payment",
  "model PaymentEvent",
  "model Refund",
  "model PaymentProvider",
  "model PaymentStatusHistory",
  "enum PaymentStatus",
  "PAID_WAITING_FOR_ADMIN_REVIEW",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "PARTIALLY_REFUNDED",
]);

await includes("src/lib/payments.ts", [
  "checkout.sessions.create",
  "constructEvent",
  "payment.checkout_created",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
  "payment.partial_refunded",
  "payment.webhook_received",
  "PAID_WAITING_FOR_ADMIN_REVIEW",
]);

await includes("src/lib/constants.ts", [
  "PAYMENT_PENDING: [\"PAID_WAITING_FOR_ADMIN_REVIEW\", \"PAYMENT_FAILED\", \"CANCELLED\"]",
  "PAID_WAITING_FOR_ADMIN_REVIEW: [\"APPROVED\", \"REJECTED\", \"WAITING_FOR_CUSTOMER\", \"CANCELLED\"]",
]);

for (const filePath of [
  "src/app/api/payments/checkout/route.ts",
  "src/app/api/customer/payments/route.ts",
  "src/app/api/customer/payments/[id]/route.ts",
  "src/app/api/stripe/webhook/route.ts",
  "src/app/api/admin/payments/route.ts",
  "src/app/api/admin/payments/[id]/refund/route.ts",
  "src/app/customer/payments/page.tsx",
  "src/app/admin/payments/page.tsx",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes(".env.example", [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]);
await includes("README.md", ["Modul 10", "Stripe Checkout", "Webhooks", "Refunds", "Testkarten"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Vorkasse", "Stripe Checkout", "Webhooks", "Adminpruefung erst nach Zahlung"]);

const [
  paymentCount,
  paidCount,
  failedCount,
  refundCount,
  partialRefundCount,
  provider,
  paidWaitingOrders,
  checkoutAudit,
  completedAudit,
  failedAudit,
  refundedAudit,
  webhookAudit,
  paymentNotifications,
] = await Promise.all([
  prisma.payment.count(),
  prisma.payment.count({ where: { status: "PAID" } }),
  prisma.payment.count({ where: { status: "FAILED" } }),
  prisma.refund.count(),
  prisma.refund.count({ where: { type: "PARTIAL" } }),
  prisma.paymentProvider.findUnique({ where: { code: "stripe" } }),
  prisma.order.count({ where: { status: "PAID_WAITING_FOR_ADMIN_REVIEW" } }),
  prisma.auditLog.count({ where: { action: "payment.checkout_created" } }),
  prisma.auditLog.count({ where: { action: "payment.completed" } }),
  prisma.auditLog.count({ where: { action: "payment.failed" } }),
  prisma.auditLog.count({ where: { action: { in: ["payment.refunded", "payment.partial_refunded"] } } }),
  prisma.auditLog.count({ where: { action: "payment.webhook_received" } }),
  prisma.notification.count({ where: { type: { in: ["PAYMENT_SUCCESS", "PAYMENT_FAILED", "PAYMENT_REFUNDED", "PAYMENT_COMPLETED"] } } }),
]);

assert(provider, "Stripe PaymentProvider fehlt.");
assert(paymentCount >= 10, "Seed enthaelt weniger als 10 Zahlungen.");
assert(paidCount >= 3, "Erfolgreiche Seed-Zahlungen fehlen.");
assert(failedCount >= 2, "Fehlgeschlagene Seed-Zahlungen fehlen.");
assert(refundCount >= 2, "Refund-Seed fehlt.");
assert(partialRefundCount >= 1, "Teilrefund-Architektur/Seed fehlt.");
assert(paidWaitingOrders >= 3, "Bezahlte Auftraege warten nicht auf Adminpruefung.");
assert(checkoutAudit >= 1, "payment.checkout_created AuditLog fehlt.");
assert(completedAudit >= 1, "payment.completed AuditLog fehlt.");
assert(failedAudit >= 1, "payment.failed AuditLog fehlt.");
assert(refundedAudit >= 1, "Refund AuditLog fehlt.");
assert(webhookAudit >= 1, "payment.webhook_received AuditLog fehlt.");
assert(paymentNotifications >= 4, "Payment-Notifications fehlen.");

await prisma.$disconnect();
console.log("Module 10 smoke checks passed.");
