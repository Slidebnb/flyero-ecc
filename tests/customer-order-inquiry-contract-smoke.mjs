import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const validators = readFileSync("src/lib/validators.ts", "utf8");
const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const materialStep = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");

assert.match(
  validators,
  /quoteFingerprint:\s*z\.preprocess\([\s\S]{0,260}z\.string\(\)\.regex\(\/\^\[a-f0-9\]\{64\}\$\//,
  "Eine unverbindliche Anfrage muss ohne fertige Preisquote validierbar sein.",
);
assert.match(
  validators,
  /data\.completionPath !== "direct_payment" \|\| Boolean\(data\.quoteFingerprint\)/,
  "Direktzahlungen muessen weiterhin eine aktuelle Preisquote verlangen.",
);
assert.match(
  orderRoute,
  /data\.completionPath === "direct_payment"[\s\S]{0,300}data\.quoteFingerprint !== intelligence\.metrics\.fingerprint/,
  "Die API muss den Quote-Fingerprint nur beim direkten Zahlungsweg zwingend vergleichen.",
);
assert.match(
  wizard,
  /completionPath === "direct_payment" && !isPublicPlanner && !selectedWarehouseId/,
  "Der Wizard darf fuer eine unverbindliche Anfrage kein Empfangslager erzwingen.",
);
assert.match(
  wizard,
  /completionPath === "direct_payment" && !isPublicPlanner && \(/,
  "Der Wizard darf fuer eine unverbindliche Anfrage keine fertige Quote erzwingen.",
);
assert.match(materialStep, /Art der Probe/);
assert.match(materialStep, /sampleType/);
assert.match(wizard, /sampleType/);

console.log("Customer order inquiry contract checks passed.");
