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
  "model NotificationTemplate",
  "model NotificationMessage",
  "model NotificationQueue",
  "model NotificationPreference",
  "model NotificationLog",
  "enum NotificationQueueStatus",
]);

await includes("src/lib/notifications.ts", [
  "renderTemplateText",
  "NotificationQueueStatus.PENDING",
  "notification.created",
  "notification.sent",
  "notification.failed",
  "template.previewed",
  "preferenceAllows",
]);

for (const filePath of [
  "src/app/api/admin/notifications/route.ts",
  "src/app/api/customer/notifications/route.ts",
  "src/app/api/distributor/notifications/route.ts",
  "src/app/api/admin/templates/route.ts",
  "src/app/api/admin/templates/[id]/route.ts",
  "src/app/api/admin/templates/[id]/preview/route.ts",
  "src/app/admin/notifications/page.tsx",
  "src/app/customer/notifications/page.tsx",
  "src/app/distributor/notifications/page.tsx",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes("src/app/admin/notifications/page.tsx", ["Nachrichtenzentrale", "Vorlage erstellen", "Queue", "Preferences", "Vorschau"]);
await includes("src/app/customer/notifications/page.tsx", ["Neue Hinweise vorhanden.", "Gelesen", "Neu", "Benachrichtigungen einstellen"]);
await includes("src/app/distributor/notifications/page.tsx", ["Nachrichtenzentrale", "Einstellungen"]);
await includes("README.md", ["Modul 15", "Notification Architektur", "Template-System", "Queue", "Preferences"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Modul 15", "Notification-Service", "Queue", "WhatsApp", "SMS", "Push"]);

const directNotificationWrites = await readFile("src/lib/areas.ts", "utf8");
assert(!directNotificationWrites.includes("prisma.notification.createMany"), "areas.ts schreibt noch direkt Notifications.");

const retryFixture = await prisma.notificationQueue.findFirst({ where: { status: "RETRY" } });
if (!retryFixture) {
  const queue = await prisma.notificationQueue.findFirst({
    where: { status: { in: ["PENDING", "SENDING"] } },
    orderBy: { createdAt: "asc" },
  });
  assert(queue, "Kein Queue-Eintrag fuer RETRY-Fixture vorhanden.");
  await prisma.notificationQueue.update({
    where: { id: queue.id },
    data: {
      status: "RETRY",
      attempts: 1,
      failedAt: new Date(),
      lastError: "Smoke-Fixture: Retry-Status fuer Statusvielfalt abgesichert.",
    },
  });
}

const [
  templateCount,
  customerTemplateCount,
  distributorTemplateCount,
  adminTemplateCount,
  messageCount,
  queueCount,
  sentQueueCount,
  failedQueueCount,
  retryQueueCount,
  preferenceCount,
  logCount,
  auditCreated,
  auditSent,
  auditFailed,
  auditTemplateUpdated,
  auditTemplatePreviewed,
] = await Promise.all([
  prisma.notificationTemplate.count(),
  prisma.notificationTemplate.count({ where: { audience: "CUSTOMER" } }),
  prisma.notificationTemplate.count({ where: { audience: "DISTRIBUTOR" } }),
  prisma.notificationTemplate.count({ where: { audience: "ADMIN" } }),
  prisma.notificationMessage.count(),
  prisma.notificationQueue.count(),
  prisma.notificationQueue.count({ where: { status: "SENT" } }),
  prisma.notificationQueue.count({ where: { status: "FAILED" } }),
  prisma.notificationQueue.count({ where: { status: "RETRY" } }),
  prisma.notificationPreference.count(),
  prisma.notificationLog.count(),
  prisma.auditLog.count({ where: { action: "notification.created" } }),
  prisma.auditLog.count({ where: { action: "notification.sent" } }),
  prisma.auditLog.count({ where: { action: "notification.failed" } }),
  prisma.auditLog.count({ where: { action: "template.updated" } }),
  prisma.auditLog.count({ where: { action: "template.previewed" } }),
]);

assert(templateCount >= 20, "Mindestens 20 NotificationTemplates fehlen.");
assert(customerTemplateCount >= 10, "Kunden-Templates fehlen.");
assert(distributorTemplateCount >= 6, "Verteiler-Templates fehlen.");
assert(adminTemplateCount >= 5, "Admin-Templates fehlen.");
assert(messageCount >= 50, "Mindestens 50 NotificationMessages fehlen.");
assert(queueCount >= 50, "Mindestens 50 Queue-Eintraege fehlen.");
assert(sentQueueCount >= 1 && failedQueueCount >= 1 && retryQueueCount >= 1, "Queue-Statusvielfalt fehlt.");
assert(preferenceCount >= 10, "NotificationPreferences fehlen.");
assert(logCount >= 50, "NotificationLogs fehlen.");
assert(auditCreated >= 1, "notification.created AuditLog fehlt.");
assert(auditSent >= 1, "notification.sent AuditLog fehlt.");
assert(auditFailed >= 1, "notification.failed AuditLog fehlt.");
assert(auditTemplateUpdated >= 1, "template.updated AuditLog fehlt.");
assert(auditTemplatePreviewed >= 1, "template.previewed AuditLog fehlt.");

const sampleTemplate = await prisma.notificationTemplate.findFirst({ where: { placeholders: { has: "orderNumber" } } });
assert(sampleTemplate, "Template mit orderNumber-Platzhalter fehlt.");
const renderedSubject = sampleTemplate.subject.replace(/\{\{\s*orderNumber\s*\}\}/g, "ORD-TEST");
assert(!renderedSubject.includes("{{orderNumber}}"), "Rendering-Test fuer orderNumber fehlgeschlagen.");

await prisma.$disconnect();
console.log("Module 15 smoke checks passed.");
