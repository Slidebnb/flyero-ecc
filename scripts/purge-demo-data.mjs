import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const apply = process.argv.includes("--apply");
const preserveEmails = (process.env.PRESERVE_EMAILS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const preserveClause = preserveEmails.length
  ? Prisma.sql`AND lower("email") NOT IN (${Prisma.join(preserveEmails)})`
  : Prisma.empty;

const checks = [
  ["Beispielkonten", Prisma.sql`SELECT count(*)::int AS count FROM "User" WHERE lower("email") LIKE '%@example.com'`],
  ["Demoaufträge", Prisma.sql`SELECT count(*)::int AS count FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%'`],
  ["Seed-Gebiete", Prisma.sql`SELECT count(*)::int AS count FROM "DistributionArea" WHERE "dataSourceType" = 'SEED'`],
  ["Demo-Lager", Prisma.sql`SELECT count(*)::int AS count FROM "Warehouse" WHERE "isDemoData" = true`],
  ["Seed-Leads", Prisma.sql`SELECT count(*)::int AS count FROM "Lead" WHERE "source" LIKE 'seed%'`],
  ["Seed-Dokumente", Prisma.sql`SELECT count(*)::int AS count FROM "Document" WHERE "storedFilename" LIKE 'seed/%' OR "title" LIKE 'Seed Modul%'`],
  ["Seed-Druckpartner", Prisma.sql`SELECT count(*)::int AS count FROM "PrintPartner" WHERE "email" LIKE '%print-seed-%'`],
  ["Seed-Buchhaltungsexporte", Prisma.sql`SELECT count(*)::int AS count FROM "AccountingExport" WHERE "exportNumber" LIKE 'ACC-SEED-%'`],
];

async function countRows(query) {
  const [row] = await prisma.$queryRaw(query);
  return Number(row?.count ?? 0);
}

async function report(label) {
  const values = await Promise.all(checks.map(async ([name, query]) => [name, await countRows(query)]));
  console.log(`${label}:`);
  for (const [name, count] of values) console.log(`- ${name}: ${count}`);
}

async function purge(tx) {
  const statements = [
    ["Seed-Benachrichtigungswarteschlangen", Prisma.sql`DELETE FROM "NotificationQueue" WHERE "userId" IN (SELECT "id" FROM "User" WHERE lower("email") LIKE '%@example.com') OR "payload"->>'source' LIKE 'seed%' OR "data"->>'source' LIKE 'seed%'`],
    ["Seed-Benachrichtigungen", Prisma.sql`DELETE FROM "NotificationMessage" WHERE "userId" IN (SELECT "id" FROM "User" WHERE lower("email") LIKE '%@example.com') OR "data"->>'source' LIKE 'seed%'`],
    ["Seed-Ticketanhänge", Prisma.sql`DELETE FROM "TicketAttachment" WHERE "fileName" LIKE 'seed-%' OR "fileUrl" LIKE '%seed-module%'`],
    ["Seed-Ticketnachrichten", Prisma.sql`DELETE FROM "TicketMessage" WHERE "ticketId" IN (SELECT "id" FROM "SupportTicket" WHERE "subject" ILIKE '%seed%' OR "description" ILIKE '%seed%' OR "createdById" IN (SELECT "id" FROM "User" WHERE lower("email") LIKE '%@example.com'))`],
    ["Seed-Supporttickets", Prisma.sql`DELETE FROM "SupportTicket" WHERE "subject" ILIKE '%seed%' OR "description" ILIKE '%seed%' OR "createdById" IN (SELECT "id" FROM "User" WHERE lower("email") LIKE '%@example.com')`],
    ["Seed-Dokumente", Prisma.sql`DELETE FROM "Document" WHERE "storedFilename" LIKE 'seed/%' OR "title" LIKE 'Seed Modul%'`],
    ["Seed-Druckaufträge", Prisma.sql`DELETE FROM "PrintOrder" WHERE "notes" LIKE 'seed.%' OR "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%')`],
    ["Seed-Zahlungsstreitfälle", Prisma.sql`DELETE FROM "PaymentDispute" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%') OR "customerId" IN (SELECT "id" FROM "CustomerProfile" WHERE "userId" IN (SELECT "id" FROM "User" WHERE lower("email") LIKE '%@example.com'))`],
    ["Seed-Rechnungen", Prisma.sql`DELETE FROM "Invoice" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%') OR "invoiceNumber" LIKE 'INV-SEED-%'`],
    ["Seed-Erstattungen", Prisma.sql`DELETE FROM "Refund" WHERE "reason" ILIKE 'Seed %' OR "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%')`],
    ["Seed-Lagerzählungen", Prisma.sql`DELETE FROM "WarehouseStockCount" WHERE "notes" ILIKE '%seed%' OR "inventoryId" IN (SELECT "id" FROM "WarehouseInventory" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%'))`],
    ["Seed-Lagertransfers", Prisma.sql`DELETE FROM "WarehouseTransfer" WHERE "notes" ILIKE '%seed%' OR "inventoryId" IN (SELECT "id" FROM "WarehouseInventory" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%'))`],
    ["Seed-Sendungen", Prisma.sql`DELETE FROM "LogisticsShipment" WHERE "notes" ILIKE '%seed%' OR "orderId" IN (SELECT "id" FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%')`],
    ["Seed-Aufträge", Prisma.sql`DELETE FROM "Order" WHERE "orderNumber" LIKE 'DEMO-%'`],
    ["Seed-Touren ohne Auftrag", Prisma.sql`DELETE FROM "DistributionTour" WHERE "id" LIKE 'demo-%'`],
    ["Seed-Leads", Prisma.sql`DELETE FROM "Lead" WHERE "source" LIKE 'seed%' OR lower("email") LIKE '%@example.com' AND "email" LIKE '%lead%'`],
    ["Seed-Analytics-Refunds", Prisma.sql`DELETE FROM "Refund" WHERE "reason" ILIKE 'Seed Modul 19%'`],
    ["Seed-Druckpartner", Prisma.sql`DELETE FROM "PrintPartner" WHERE "email" LIKE '%print-seed-%'`],
    ["Seed-Buchhaltungsexporte", Prisma.sql`DELETE FROM "AccountingExport" WHERE "exportNumber" LIKE 'ACC-SEED-%'`],
    ["Seed-Gebiets-Historie", Prisma.sql`DELETE FROM "AreaHistory" WHERE "newValue"->>'seed' = 'true' OR "action" LIKE 'seed.%'`],
    ["Seed-Gebiete", Prisma.sql`DELETE FROM "DistributionArea" WHERE "dataSourceType" = 'SEED' AND NOT EXISTS (SELECT 1 FROM "Order" WHERE "distributionAreaId" = "DistributionArea"."id") AND NOT EXISTS (SELECT 1 FROM "OrderDistributionSegment" WHERE "distributionAreaId" = "DistributionArea"."id")`],
    ["Seed-Systemlogs", Prisma.sql`DELETE FROM "SystemLog" WHERE "source" LIKE 'seed.%'`],
    ["Seed-Fehlerlogs", Prisma.sql`DELETE FROM "ErrorLog" WHERE "source" LIKE 'seed.%'`],
    ["Seed-Healthchecks", Prisma.sql`DELETE FROM "SystemHealthCheck" WHERE "metadata"->>'source' LIKE 'seed.%'`],
    ["Seed-Backgroundjobs", Prisma.sql`DELETE FROM "BackgroundJobLog" WHERE "metadata"->>'source' LIKE 'seed.%'`],
    ["Seed-Auditlogs", Prisma.sql`DELETE FROM "AuditLog" WHERE "action" LIKE 'seed.%' OR "entityId" LIKE 'seed%'`],
    ["Seed-Lagerorte", Prisma.sql`DELETE FROM "WarehouseLocation" WHERE "warehouseId" IN (SELECT "id" FROM "Warehouse" WHERE "isDemoData" = true)`],
    ["Nicht referenzierte Demo-Lager", Prisma.sql`DELETE FROM "Warehouse" WHERE "isDemoData" = true AND NOT EXISTS (SELECT 1 FROM "WarehouseInventory" WHERE "warehouseId" = "Warehouse"."id") AND NOT EXISTS (SELECT 1 FROM "WarehouseRegion" WHERE "warehouseId" = "Warehouse"."id") AND NOT EXISTS (SELECT 1 FROM "WarehouseStockCount" WHERE "warehouseId" = "Warehouse"."id") AND NOT EXISTS (SELECT 1 FROM "WarehouseTransfer" WHERE "fromWarehouseId" = "Warehouse"."id" OR "toWarehouseId" = "Warehouse"."id")`],
    ["Beispielkonten", Prisma.sql`DELETE FROM "User" WHERE lower("email") LIKE '%@example.com' ${preserveClause}`],
    ["Leere Seed-Tenants", Prisma.sql`DELETE FROM "Tenant" WHERE "slug" LIKE 'seed-%' AND NOT EXISTS (SELECT 1 FROM "User" WHERE "tenantId" = "Tenant"."id") AND NOT EXISTS (SELECT 1 FROM "CustomerProfile" WHERE "tenantId" = "Tenant"."id") AND NOT EXISTS (SELECT 1 FROM "Order" WHERE "tenantId" = "Tenant"."id")`],
  ];

  for (const [label, statement] of statements) {
    const count = await tx.$executeRaw(statement);
    console.log(`- ${label}: ${count} gelöscht`);
  }
}

try {
  await report("Vor der Bereinigung");
  if (!apply) {
    console.log("Nur Vorschau. Für die tatsächliche Bereinigung: NODE_ENV=production CONFIRM_DEMO_PURGE=FLYERO_PURGE_DEMO_DATA PRESERVE_EMAILS=... node scripts/purge-demo-data.mjs --apply");
    process.exitCode = 0;
  } else {
    if (process.env.NODE_ENV !== "production") throw new Error("Die Bereinigung darf nur mit NODE_ENV=production laufen.");
    if (process.env.CONFIRM_DEMO_PURGE !== "FLYERO_PURGE_DEMO_DATA") throw new Error("CONFIRM_DEMO_PURGE fehlt oder ist falsch.");
    if (preserveEmails.length === 0) throw new Error("PRESERVE_EMAILS muss mindestens das echte Admin-Konto enthalten.");
    await prisma.$transaction((tx) => purge(tx), { timeout: 120_000 });
    await report("Nach der Bereinigung");
  }
} finally {
  await prisma.$disconnect();
}
