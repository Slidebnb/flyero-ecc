import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const customerUx = await readFile("src/app/customer/customerUx.ts", "utf8");
const customerSupportPage = await readFile("src/app/customer/support/page.tsx", "utf8");
const customerSupportDetail = await readFile("src/app/customer/support/tickets/[id]/page.tsx", "utf8");

assert.match(customerUx, /REJECTED:\s*"Geschlossen"/, "Abgelehnte Kampagnen brauchen im Kundenportal eine verständliche Abschlussbezeichnung.");
assert.match(customerUx, /CUSTOMER_SUPPORT_STATUS_LABELS[\s\S]*WAITING_INTERNAL:\s*"In Pr.*fung"/, "Interne Rückfragen brauchen im Kundenportal eine verständliche Bezeichnung.");
assert.match(customerUx, /CUSTOMER_SUPPORT_STATUS_LABELS[\s\S]*REJECTED:\s*"Geschlossen"/, "Abgelehnte Supportfälle dürfen im Kundenportal nicht technisch benannt werden.");
assert.match(customerSupportPage, /CUSTOMER_SUPPORT_STATUS_LABELS/, "Die Supportübersicht muss kundengerechte Statuslabels verwenden.");
assert.match(customerSupportDetail, /CUSTOMER_SUPPORT_STATUS_LABELS/, "Der Supportdetailbereich muss kundengerechte Statuslabels verwenden.");

for (const source of [customerUx, customerSupportPage, customerSupportDetail]) {
  assert.doesNotMatch(source, /"Wartet intern"|"Abgelehnt"/, "Interne Statuslabels dürfen nicht im Kundencode sichtbar gerendert werden.");
}

console.log("Customer status copy smoke checks passed.");
