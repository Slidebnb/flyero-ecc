import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/app/customer/orders/new/page.tsx",
  "src/app/customer/orders/page.tsx",
  "src/app/customer/orders/[id]/page.tsx",
  "src/app/admin/orders/page.tsx",
  "src/app/admin/orders/[id]/page.tsx",
  "src/app/api/customer/orders/route.ts",
  "src/app/api/customer/orders/[id]/route.ts",
  "src/app/api/admin/orders/route.ts",
  "src/app/api/admin/orders/[id]/route.ts",
  "src/app/api/admin/orders/[id]/status/route.ts",
  "src/app/api/admin/orders/[id]/price/route.ts",
  "src/app/api/admin/orders/[id]/note/route.ts",
  "src/lib/pricing.ts",
  "src/lib/orders.ts",
  "prisma/migrations/20260629203000_module3_orders/migration.sql",
];

const requiredSchemaSnippets = [
  "enum ServiceType",
  "SUBMITTED",
  "READY_FOR_FLYERS",
  "serviceType          ServiceType",
  "targetAreaName       String",
  "calculatedNetPrice",
  "manualPriceOverride",
  "model OrderStatusEvent",
  "model PricingSetting",
  "model PricingRule",
];

const requiredStatusSnippets = [
  "DRAFT: [\"PAYMENT_PENDING\", \"CANCELLED\"]",
  "PAYMENT_PENDING: [\"PAID_WAITING_FOR_ADMIN_REVIEW\", \"PAYMENT_FAILED\", \"CANCELLED\"]",
  "PAID_WAITING_FOR_ADMIN_REVIEW: [\"APPROVED\", \"REJECTED\", \"WAITING_FOR_CUSTOMER\", \"CANCELLED\"]",
  "APPROVED: [\"READY_FOR_FLYERS\", \"CANCELLED\"]",
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Modul-3-Datei fehlt: ${file}`);
  }
}

const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
for (const snippet of requiredSchemaSnippets) {
  if (!schema.includes(snippet)) {
    throw new Error(`Prisma-Schema enthaelt erwarteten Abschnitt nicht: ${snippet}`);
  }
}

const constants = readFileSync(join(root, "src/lib/constants.ts"), "utf8");
for (const snippet of requiredStatusSnippets) {
  if (!constants.includes(snippet)) {
    throw new Error(`Statusmaschine enthaelt erwarteten Uebergang nicht: ${snippet}`);
  }
}

console.log("Modul-3-Smoke-Test erfolgreich.");
