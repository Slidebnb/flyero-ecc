import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pricingPage = await readFile("src/app/preise/page.tsx", "utf8");
const pricingRoute = await readFile("src/app/api/public/planner/quote/route.ts", "utf8");

assert.match(pricingPage, /try \{[\s\S]*getPricingSettings\(\)[\s\S]*catch/, "Die Preisseite muss einen kundenfreundlichen Datenbank-/Pricing-Fehlerzustand rendern.");
assert.ok(pricingPage.includes(String.raw`Preise werden gerade gepr\u00fcft`), "Die Preisseite braucht einen verständlichen Prüfhinweis.");
assert.match(pricingRoute, /errorResponse\([^,]+, 503\)/, "Der öffentliche Preisendpoint muss bei serverseitigem Pricing-Fehler 503 statt 500 liefern.");
assert.ok(pricingRoute.includes(String.raw`Die Preisberechnung wird gerade gepr\u00fcft`), "Der öffentliche Preisendpoint darf keinen technischen Fehlertext an Kunden geben.");

console.log("Public pricing error-boundary smoke checks passed.");