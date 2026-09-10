import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile("src/app/api/admin/notifications/customer-campaign/route.ts", "utf8");
const form = await readFile("src/app/admin/notifications/CustomerCampaignForm.tsx", "utf8");
const template = await readFile("src/lib/customerEmailTemplate.ts", "utf8");
const schema = await readFile("prisma/schema.prisma", "utf8");

assert.match(route, /requirePermission\(Permission\.NOTIFICATION_OPERATIONS_MANAGE\)/);
assert.match(route, /role: UserRole\.CUSTOMER/);
assert.match(route, /emailVerified: \{ not: null \}/);
assert.match(route, /createNotification\(/);
assert.match(route, /idempotencyKey/);
assert.match(route, /allow_promotion_codes|couponCode/);
assert.match(form, /Kundenaktion an alle senden/);
assert.match(form, /crypto\.randomUUID\(\)/);
assert.match(template, /CUSTOMER_PROMOTION_CAMPAIGN/);
assert.match(template, /couponCode/);
assert.match(schema, /model CustomerEmailCampaign/);
assert.match(schema, /idempotencyKey\s+String\s+@unique/);

console.log("Customer campaign smoke checks passed.");
