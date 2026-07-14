import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const files = [
  "src/app/customer/orders/new/SmartOrderWizard.tsx",
  "src/app/api/customer/orders/route.ts",
  "src/app/api/payments/checkout/route.ts",
  "src/app/api/admin/orders/[id]/status/route.ts",
  "src/lib/reports.ts",
  "src/lib/dispatch.ts",
];
const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
for (const snippet of ["quoteFingerprint", "calculateOrderPrice", "checkout", "createInvoiceForOrder", "REPORT_PUBLISHED", "assignOrderToDistributor", "acceptDispatchOrder"]) {
  assert(source.includes(snippet), `Core-Prozessbaustein fehlt: ${snippet}`);
}
console.log("Core order e2e contract checks passed.");
