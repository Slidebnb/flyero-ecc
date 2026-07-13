import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = new Map([
  ["adminApi", "src/app/api/admin/settings/pricing/route.ts"],
  ["adminPage", "src/app/admin/settings/pricing/page.tsx"],
  ["newOrder", "src/app/api/customer/orders/route.ts"],
  ["updateOrder", "src/app/api/customer/orders/[id]/route.ts"],
  ["maps", "src/lib/smartMaps.ts"],
  ["payments", "src/lib/payments.ts"],
  ["invoices", "src/lib/invoices.ts"],
  ["customerDashboard", "src/app/customer/dashboard/page.tsx"],
  ["customerUx", "src/app/customer/customerUx.ts"],
  ["publicPricing", "src/app/preise/page.tsx"],
  ["pricing", "src/lib/pricing.ts"],
]);

const source = new Map();
for (const [name, file] of files) {
  source.set(name, await readFile(file, "utf8"));
}

const adminApi = source.get("adminApi");
const adminPage = source.get("adminPage");
const pricing = source.get("pricing");

for (const name of ["newOrder", "updateOrder", "maps", "payments", "pricing"]) {
  const content = source.get(name);
  assert.match(content, /calculateOrderPrice/, `${name} muss die zentrale Preisberechnung verwenden.`);
}

for (const [name, content] of [["adminApi", adminApi], ["adminPage", adminPage]]) {
  assert.match(content, /syncOpenOrderPrices\(\)/, `${name} muss Preisänderungen in offene Aufträge propagieren.`);
  assert.match(content, /revalidatePath\("\/customer\/(dashboard|orders)/, `${name} muss Kundenansichten nach einer Preisänderung invalidieren.`);
}

assert.match(adminApi, /createAuditLog/, "Admin-Preisänderungen müssen revisionssicher protokolliert werden.");
assert.match(adminApi, /notifyAdmins/, "Admin-Preisänderungen müssen intern benachrichtigt werden.");
assert.match(source.get("adminPage"), /revalidatePath\("\/customer\/orders\/\[id\]",\s*"page"\)/, "Die Server-Action muss dynamische Kunden-Auftragsseiten nach einer Preisänderung invalidieren.");
assert.match(pricing, /OPEN_PRICE_ORDER_STATUSES/, "Offene Orderstatus müssen zentral definiert sein.");
assert.match(pricing, /SETTLED_PAYMENT_STATUSES/, "Bezahlte oder erstattete Aufträge müssen vor automatischer Preisänderung geschützt sein.");
assert.match(pricing, /pricingRuleSignature/, "Jede Preisberechnung muss ihre aktuelle Regel-Signatur speichern.");
assert.match(pricing, /withCurrentPricingSnapshot/, "Gebiets- und Preis-Snapshot muessen gemeinsam aktualisiert werden.");
assert.match(pricing, /Mindestens eine aktive Flyer-Preisregel ist erforderlich/, "Alle Flyer-Preisregeln duerfen nicht deaktiviert werden.");
assert.match(pricing, /invalidatedCheckoutCount/, "Offene Checkout-Zahlungen müssen bei einer Preisänderung ungültig werden.");
assert.match(source.get("invoices"), /priceRuleSnapshot/, "Rechnungen müssen den gespeicherten Auftragspreis-Snapshot verwenden.");
assert.match(source.get("customerDashboard"), /getOrderGrossPrice/, "Das Kunden-Dashboard muss denselben effektiven Auftragspreis anzeigen.");
assert.match(source.get("customerUx"), /ORDER_PRICE_UPDATED:\s*"Preisvorschau aktualisiert"/, "Preisänderungen müssen im Kundenportal verständlich benannt werden.");
assert.match(source.get("publicPricing"), /getPricingSettings/, "Die öffentliche Preisseite muss aktuelle Admin-Preisregeln verwenden.");
assert.match(source.get("publicPricing"), /dynamic\s*=\s*"force-dynamic"/, "Die öffentliche Preisseite darf keinen veralteten Preis-Cache verwenden.");
assert.match(source.get("publicPricing"), /distributionRules/, "Die öffentliche Preisseite muss die aktiven Verteilungsregeln darstellen.");

assert.match(adminApi, /revalidatePath\("\/preise"\)/, "Admin-API invalidiert die öffentliche Preisseite.");
assert.match(adminPage, /revalidatePath\("\/preise"\)/, "Server-Action invalidiert die öffentliche Preisseite.");

console.log("Pricing system linkage smoke checks passed.");
