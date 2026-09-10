import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const supportPage = await readFile("src/app/customer/support/page.tsx", "utf8");
const ticketPage = await readFile("src/app/customer/support/tickets/[id]/page.tsx", "utf8");
const orderPage = await readFile("src/app/customer/orders/[id]/page.tsx", "utf8");
const customerUx = await readFile("src/app/customer/customerUx.ts", "utf8");
const wizard = await readFile("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const materialStep = await readFile("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const css = await readFile("src/app/globals.css", "utf8");

assert.match(supportPage, /redirect\("\/customer\/support\?created=1"\)/, "Support-Senden muss zur sichtbaren Erfolgsanzeige zurückkehren.");
assert.match(supportPage, /created\?: string/, "Support-Seite muss den Erfolgsstatus aus der URL lesen können.");
assert.match(supportPage, /support-success/, "Support-Seite braucht eine eindeutige Erfolgsanzeige.");

assert.match(ticketPage, /redirect\(`\/customer\/support\/tickets\/\$\{ticketId\}\?sent=1`\)/, "Support-Antwort muss einen sichtbaren Erfolgszustand auslösen.");
assert.match(ticketPage, /sent\?: string/, "Ticket-Seite muss den Antwortstatus aus der URL lesen können.");

const activeOrderPage = orderPage.replace(/\{false \?[\s\S]*?\)\s*:\s*null\}/, "");
assert.match(activeOrderPage, /action=\"\/api\/payments\/checkout\"/, "Offene Zahlung muss ueber den Checkout-Endpunkt abgesendet werden.");
assert.match(customerUx, /Zahlung abschlie/, "Die zentrale Zahlungsaktion muss kundenverstaendlich benannt sein.");
assert.strictEqual((activeOrderPage.match(/action=\"\/api\/payments\/checkout\"/g) ?? []).length, 1, "Es darf nur eine Zahlungsaktion geben.");

assert.match(css, /customerSimpleForm[^\{]*select/, "Support-Auswahlfelder brauchen einen expliziten Kontrast.");
assert.match(css, /customerSimpleForm[^\{]*color-scheme|color-scheme:\s*dark/, "Kundenformulare muessen ein konsistentes Farbschema erzwingen.");

assert.match(wizard, /useState\(MINIMUM_FLYER_QUANTITY\)/, "Die neue Verteilung muss mit der zentralen Mindestmenge starten.");
assert.match(materialStep, /flyerQuantity > 0 \? flyerQuantity : \"\"/, "Leere Flyermenge muss als leerer Eingabestatus dargestellt werden.");
assert.match(wizard, /freshStart[\s\S]*?setFlyerQuantity\(MINIMUM_FLYER_QUANTITY\)/, "Ein neuer Auftrag muss mit der zentralen Mindestmenge starten.");
assert.match(wizard, /restoredQuantityTouched[\s\S]*?setFlyerQuantity\(MINIMUM_FLYER_QUANTITY\)/, "Ein unverändertes altes Entwurfsfeld darf keine falsche Menge vortäuschen.");
assert.match(materialStep, /Bitte gib die gewuenschte Menge ein|Mindestmenge|Ab 1\.000 Stück/, "Die Mengenmaske muss eine klare Eingabeaufforderung statt einer stillen Menge zeigen.");

console.log("Customer portal action UX smoke tests passed.");
