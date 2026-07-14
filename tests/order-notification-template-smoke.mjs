import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const seed = readFileSync("prisma/seed.mjs", "utf8");
const notifications = readFileSync("src/lib/notifications.ts", "utf8");
for (const key of ["ORDER_SUBMITTED", "ORDER_UNDER_REVIEW", "ORDER_CLARIFICATION_REQUESTED", "ORDER_ACCEPTED_PAYMENT_REQUIRED", "ORDER_APPROVED_CUSTOMER_FLYERS", "ORDER_APPROVED_PRINT_SERVICE", "ORDER_REJECTED", "ORDER_REFUND_STARTED", "INVOICE_AVAILABLE", "LOGISTICS_CUSTOMER_DELIVERY_EXPECTED", "DISPATCH_NEW_ORDER"]) {
  assert(seed.includes(`\"${key}\"`), `Benachrichtigungsvorlage ${key} fehlt.`);
}
for (const placeholder of ["flyerQuantity", "areaName", "netAmount", "grossAmount", "paymentUrl", "invoiceUrl", "nextStep"]) {
  assert(notifications.includes(`\"${placeholder}\"`), `Benachrichtigungsplatzhalter ${placeholder} fehlt.`);
}
console.log("Order notification template checks passed.");
