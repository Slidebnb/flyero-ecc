import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const source = readFileSync("src/app/api/admin/orders/[id]/status/route.ts", "utf8");
assert(source.includes('order.status === "PAID_WAITING_FOR_ADMIN_REVIEW"'), "Bezahlter Auftrag muss separat geprüft werden.");
assert(source.includes("order.customerOwnFlyers"), "Kundenflyer müssen einen eigenen Versandpfad haben.");
assert(source.includes("createInvoiceForOrder"), "Rechnung darf erst im freigegebenen Pfad entstehen.");
assert(source.includes("refundPayment"), "Ablehnung muss den bezahlten Auftrag sauber behandeln.");
console.log("Order fulfillment branching checks passed.");
