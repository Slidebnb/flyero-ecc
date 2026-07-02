import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "src/proxy.ts",
  "src/app/customer/dashboard/page.tsx",
  "src/app/customer/profile/page.tsx",
  "src/app/distributor/dashboard/page.tsx",
  "src/app/distributor/profile/page.tsx",
  "src/app/admin/dashboard/page.tsx",
  "src/app/admin/distributors/page.tsx",
  "src/app/admin/distributors/[id]/page.tsx",
  "src/app/api/admin/distributors/[id]/status/route.ts",
  "src/app/api/customer/profile/route.ts",
  "src/app/api/distributor/profile/route.ts",
  "src/app/api/auth/verify-email/route.ts",
  "prisma/seed.mjs",
];

const requiredSchemaSnippets = [
  "deliveryAddress Json?",
  "logoUrl        String?",
  "mobilityTypes  MobilityType[]",
  "serviceRadiusKm Int",
  "idDocumentStatus DistributorDocumentStatus",
  "oldValues  Json?",
  "newValues  Json?",
  "model EmailVerificationToken",
];

const requiredProxySnippets = [
  '{ prefix: "/customer", roles: ["CUSTOMER"] }',
  '{ prefix: "/distributor", roles: ["DISTRIBUTOR"] }',
  '{ prefix: "/warehouse", roles: ["WAREHOUSE_STAFF"] }',
  '{ prefix: "/admin", roles: ["ADMIN", "SUPPORT_DISPATCHER"] }',
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    throw new Error(`Modul-2-Datei fehlt: ${file}`);
  }
}

const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
for (const snippet of requiredSchemaSnippets) {
  if (!schema.includes(snippet)) {
    throw new Error(`Prisma-Schema enthaelt erwarteten Abschnitt nicht: ${snippet}`);
  }
}

const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
for (const snippet of requiredProxySnippets) {
  if (!proxy.includes(snippet)) {
    throw new Error(`Rollenpruefung fehlt: ${snippet}`);
  }
}

console.log("Modul-2-Smoke-Test erfolgreich.");
