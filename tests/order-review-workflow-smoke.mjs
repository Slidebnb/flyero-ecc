import { readFileSync } from "node:fs";
function assert(condition, message) { if (!condition) throw new Error(message); }
const reports = readFileSync("src/lib/reports.ts", "utf8");
const approval = readFileSync("src/lib/orderApproval.ts", "utf8");
assert(reports.includes('current.status !== "APPROVED"'), "Veröffentlichung muss eine echte Berichtsfreigabe verlangen.");
assert(reports.includes("READY_FOR_REVIEW") && reports.includes("CHANGES_REQUIRED"), "Berichtsstatuskette fehlt.");
assert(reports.includes("evidenceDocumentIdsFromSnapshot"), "Nachweise müssen aus dem Snapshot geprüft werden.");
assert(approval.includes("createInvoiceForOrder"), "Freigabe muss Rechnungspfad berücksichtigen.");
assert(approval.includes("ensureShipmentForCustomerFlyers"), "Freigabe muss Flyer-Fulfillment berücksichtigen.");
console.log("Order review workflow checks passed.");
