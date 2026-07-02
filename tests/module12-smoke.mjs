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
  "model CompanySettings",
  "model BrandingSettings",
  "model NumberingSettings",
  "model SystemSettings",
  "isDefault",
  "openingHours",
]);

await includes("src/lib/settings.ts", [
  "getCompanySettings",
  "updateCompanySettings",
  "getBrandingSettings",
  "getNumberingSettings",
  "getSystemSettings",
  "getPaymentConfigStatus",
  "getGoogleMapsConfigStatus",
  "getDefaultWarehouse",
  "generateSettingsNumber",
]);

await includes("src/lib/pricing.ts", ["getVatRate", "PRICING_SETTING_KEYS", "calculateOrderPrice"]);
await includes("src/lib/invoices.ts", ["getCompanySettings", "getBrandingSettings", "getSystemSettings", "generateSettingsNumber"]);
await includes("src/lib/reports.ts", ["getBrandingSettings", "getCompanySettings", "generateSettingsNumber"]);
await includes("src/lib/orders.ts", ["generateOrderNumber", "generateSettingsNumber"]);

for (const filePath of [
  "src/app/admin/settings/page.tsx",
  "src/app/admin/settings/company/page.tsx",
  "src/app/admin/settings/branding/page.tsx",
  "src/app/admin/settings/numbering/page.tsx",
  "src/app/admin/settings/pricing/page.tsx",
  "src/app/admin/settings/warehouses/page.tsx",
  "src/app/admin/settings/payments/page.tsx",
  "src/app/admin/settings/maps/page.tsx",
  "src/app/admin/settings/users/page.tsx",
  "src/app/api/admin/settings/company/route.ts",
  "src/app/api/admin/settings/branding/route.ts",
  "src/app/api/admin/settings/numbering/route.ts",
  "src/app/api/admin/settings/pricing/route.ts",
  "src/app/api/admin/settings/warehouses/route.ts",
  "src/app/api/admin/settings/warehouses/[id]/route.ts",
  "src/app/api/admin/settings/payments/route.ts",
  "src/app/api/admin/settings/maps/route.ts",
  "src/app/api/admin/settings/users/route.ts",
  "src/app/api/admin/settings/users/[id]/status/route.ts",
]) {
  assert(existsSync(filePath), `${filePath} fehlt.`);
}

await includes("README.md", ["Modul 12", "zentrale Settings", "ENV Keys bleiben ausserhalb der DB", "Nummernkreise"]);
await includes("ARCHITECTURE_DECISIONS.md", ["Zentrale Settings", "Keys nicht in DB", "Nummernkreise"]);
await includes("DEMO_BENUTZER.txt", ["support@example.com", "warehouse.inaktiv@example.com"]);

const [
  companyCount,
  brandingCount,
  numberingCount,
  systemCount,
  pricingRules,
  pricingSettings,
  warehouses,
  defaultWarehouse,
  internalUsers,
  disabledInternalUsers,
  settingsAudit,
  settingsNotifications,
] = await Promise.all([
  prisma.companySettings.count(),
  prisma.brandingSettings.count(),
  prisma.numberingSettings.count(),
  prisma.systemSettings.count(),
  prisma.pricingRule.count(),
  prisma.pricingSetting.count({ where: { key: { in: ["vat_rate", "express_surcharge", "photo_proof_surcharge", "warehouse_surcharge"] } } }),
  prisma.warehouse.count(),
  prisma.warehouse.count({ where: { isDefault: true, isActive: true } }),
  prisma.user.count({ where: { role: { in: ["ADMIN", "WAREHOUSE_STAFF", "SUPPORT_DISPATCHER"] } } }),
  prisma.user.count({ where: { role: { in: ["ADMIN", "WAREHOUSE_STAFF", "SUPPORT_DISPATCHER"] }, status: "DISABLED" } }),
  prisma.auditLog.count({ where: { action: { startsWith: "settings." } } }),
  prisma.notification.count({ where: { type: { in: ["SETTINGS_CHANGED", "PRICING_CHANGED", "WAREHOUSE_CHANGED", "INTERNAL_USER_DISABLED"] } } }),
]);

assert(companyCount >= 1, "CompanySettings fehlen.");
assert(brandingCount >= 1, "BrandingSettings fehlen.");
assert(numberingCount >= 1, "NumberingSettings fehlen.");
assert(systemCount >= 1, "SystemSettings fehlen.");
assert(pricingRules >= 4, "Preisregeln fehlen.");
assert(pricingSettings >= 4, "PricingSettings fuer Modul 12 fehlen.");
assert(warehouses >= 2, "Zwei Lager fehlen.");
assert(defaultWarehouse === 1, "Es muss genau ein aktives Standardlager geben.");
assert(internalUsers >= 3, "Interne Benutzer fehlen.");
assert(disabledInternalUsers >= 1, "Deaktivierter interner Benutzer fehlt.");
assert(settingsAudit >= 7, "Settings AuditLogs fehlen.");
assert(settingsNotifications >= 4, "Settings Notifications fehlen.");

const company = await prisma.companySettings.findFirst();
assert(company?.companyName === "Flyero", "CompanySettings Seed ist falsch.");
const numbering = await prisma.numberingSettings.findFirst();
assert(numbering?.invoicePrefix === "FLY-RE", "Invoice Prefix fehlt.");
assert(numbering?.orderNextNumber >= 1, "Order Nummernkreis ist ungueltig.");

await prisma.$disconnect();
console.log("Module 12 smoke checks passed.");
