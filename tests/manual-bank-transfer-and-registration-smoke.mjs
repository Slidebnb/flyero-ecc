import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const marketing = readFileSync("src/app/components/marketing/index.tsx", "utf8");
const order = readFileSync("src/app/customer/orders/[id]/page.tsx", "utf8");
const payments = readFileSync("src/app/customer/payments/page.tsx", "utf8");
const bankComponent = readFileSync("src/app/customer/ManualBankTransfer.tsx", "utf8");
const instructions = readFileSync("src/lib/paymentInstructions.ts", "utf8");
const emailTemplate = readFileSync("src/lib/customerEmailTemplate.ts", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

assert(marketing.includes('href="/register/customer"'), "Registrierung muss im öffentlichen Header direkt verlinkt sein.");
assert(marketing.includes('label: "Registrierung"'), "Registrierung muss im mobilen Menü sichtbar sein.");
assert(order.includes("<ManualBankTransfer"), "Die offene Zahlung muss im Auftragsdetail eine Überweisungsoption zeigen.");
assert(payments.includes("<ManualBankTransfer"), "Die Zahlungsübersicht muss eine Überweisungsoption zeigen.");
for (const value of ["Julia Huwa", "DE22 5704 0044 0281 6387 00", "Auftragsnummer"]) {
  assert(instructions.includes(value), `Bankangabe fehlt: ${value}`);
}
assert(bankComponent.includes("manuell geprüft"), "Die Überweisung darf nicht fälschlich als automatisch bestätigt dargestellt werden.");
assert(emailTemplate.includes("manualTransferDetails"), "Die Zahlungs-E-Mail muss die manuelle Überweisungsoption enthalten.");
assert(css.includes(".customerBankDetails"), "Die Überweisungsdaten benötigen eine responsive Darstellung.");
console.log("Manual bank transfer and registration checks passed.");
