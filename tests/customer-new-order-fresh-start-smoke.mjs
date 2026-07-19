import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const customerFiles = [
  "src/app/customer/CustomerPortalShell.tsx",
  "src/app/customer/dashboard/page.tsx",
  "src/app/customer/orders/page.tsx",
  "src/app/customer/payments/page.tsx",
  "src/app/customer/documents/page.tsx",
  "src/app/customer/orders/new/page.tsx",
  "src/app/verteilung-anfragen/page.tsx",
];
const customerSource = customerFiles.map((file) => readFileSync(file, "utf8")).join("\n");

assert.match(
  wizard,
  /const searchParams = new URLSearchParams\(window\.location\.search\);[\s\S]*const freshStart = searchParams\.get\("fresh"\) === "1"/,
  "Der Kundenwizard muss einen expliziten Frischstart erkennen.",
);
assert.match(
  wizard,
  /freshStart && !repeatFrom/,
  "Ein Frischstart darf nur bei einer neuen Verteilung greifen, nicht beim Wiederholen einer Kampagne.",
);
assert.match(
  wizard,
  /localStorage\.removeItem\(LEGACY_ORDER_DRAFT_KEY\)/,
  "Ein Frischstart muss auch den alten gespeicherten Entwurf verwerfen.",
);
assert.match(
  wizard,
  /setQuery\(""\)[\s\S]*setPostalCode\(""\)[\s\S]*setSelectedLocation\(null\)/,
  "Ein Frischstart muss Suchtext, PLZ und Auswahl sichtbar leeren.",
);
assert.doesNotMatch(
  customerSource,
  /href="\/customer\/orders\/new"/,
  "Neue-Verteilung-Links duerfen keinen alten Entwurf ohne Frischstart laden.",
);
assert.match(
  customerSource,
  /customer\/orders\/new\?fresh=1/,
  "Das Kundenportal muss neue Verteilungen mit dem Frischstart oeffnen.",
);
assert.match(
  customerSource,
  /directBookingNext = "\/customer\/orders\/new\?fresh=1"/,
  "Der öffentliche Direktbuchungs-CTA muss ebenfalls frisch starten.",
);
assert.match(
  wizard,
  /freshStart[\s\S]*repeatFrom|repeatFrom[\s\S]*freshStart/,
  "Der Wiederholungslink muss als bewusster Ausnahmeweg erhalten bleiben.",
);
assert.match(
  proxy,
  /request\.nextUrl\.pathname\}\$\{request\.nextUrl\.search\}/,
  "Der Login-Redirect muss die Frischstart-Abfrage bis nach der Anmeldung erhalten.",
);

console.log("Customer new order fresh-start contract checks passed.");
