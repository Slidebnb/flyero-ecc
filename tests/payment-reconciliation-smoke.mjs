import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [logic, service, schema, migration, route, script, packageJson] = await Promise.all([
  import("../src/lib/paymentReconciliationLogic.ts"),
  readFile("src/lib/paymentReconciliation.ts", "utf8"),
  readFile("prisma/schema.prisma", "utf8"),
  readFile("prisma/migrations/20260712213000_payment_reconciliation/migration.sql", "utf8"),
  readFile("src/app/api/admin/payments/reconcile/route.ts", "utf8"),
  readFile("scripts/reconcile-stripe.mjs", "utf8"),
  readFile("package.json", "utf8").then(JSON.parse),
]);

const match = logic.comparePaymentSnapshot(
  { status: "PAID", amountMinor: 59900, currency: "EUR" },
  { status: "succeeded", amountMinor: 59900, currency: "eur" },
);
assert.equal(match.result, "MATCH");

const mismatch = logic.comparePaymentSnapshot(
  { status: "PAID", amountMinor: 59900, currency: "EUR" },
  { status: "succeeded", amountMinor: 59901, currency: "eur" },
);
assert.equal(mismatch.result, "MISMATCH");
assert.equal(mismatch.amountMismatch, true);

assert.match(schema, /model PaymentReconciliationRun\s*\{/);
assert.match(schema, /model PaymentReconciliationIssue\s*\{/);
assert.match(migration, /PaymentReconciliationRun/);
assert.match(service, /payment\.reconciliation_completed/);
assert.match(service, /paymentIntents\.retrieve|checkout\.sessions\.retrieve/);
assert.match(route, /PAYMENT_RECONCILE/);
assert.match(route, /x-internal-api-token/);
assert.match(script, /INTERNAL_API_TOKEN/);
assert.equal(packageJson.scripts["payments:reconcile"], "node -r dotenv/config scripts/reconcile-stripe.mjs");

console.log("Payment reconciliation smoke checks passed.");
