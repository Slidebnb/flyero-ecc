import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const component = readFileSync("src/app/components/marketing/index.tsx", "utf8");
const marketing = readFileSync("src/app/marketing.tsx", "utf8");
const pricing = readFileSync("src/app/preise/page.tsx", "utf8");
const css = readFileSync("src/app/styles/marketing.css", "utf8");

for (const provider of ["stripe", "klarna", "applepay", "visa", "mastercard", "amazonpay", "paypal"]) {
  assert(component.includes(`/payments/${provider}.svg`), `Logo für ${provider} fehlt.`);
}
assert(component.includes("Die im jeweiligen Checkout verfügbaren Zahlarten zeigt Stripe automatisch an."), "Die Zahlungsanzeige muss die tatsächliche Checkout-Verfügbarkeit korrekt erklären.");
assert(marketing.includes("PaymentMethods"), "Die öffentliche Marketing-Struktur muss die Zahlungsdarstellung exportieren.");
assert(pricing.includes("<PaymentMethods />"), "Die Zahlungslogos müssen nahe der Preis-/Startentscheidung erscheinen.");
assert(css.includes(".mkPaymentMethodsLogos"), "Die Zahlungslogos benötigen eine responsive Layout-Regel.");
console.log("Public payment methods checks passed.");
