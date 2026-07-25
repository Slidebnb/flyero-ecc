import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const orderRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const hook = readFileSync("src/app/customer/orders/new/hooks/useOrderIntelligence.ts", "utf8");
const recovery = readFileSync("src/app/customer/orders/new/quoteRecovery.ts", "utf8");

assert.match(
  orderRoute,
  /code:\s*"PLANNING_QUOTE_CHANGED"[\s\S]*data:\s*\{\s*quote:\s*intelligence\.metrics\.quote,\s*intelligence\s*\}/,
  "Ein veralteter Preis muss die neu berechnete Quote und die zugehoerigen Gebietsmetriken zurueckgeben.",
);
assert.match(
  hook,
  /replaceIntelligence|acceptIntelligence/,
  "Der Wizard muss eine serverseitig aktualisierte Quote in seinen bestaetigten Zustand uebernehmen koennen.",
);
assert.match(
  wizard,
  /PLANNING_QUOTE_CHANGED/,
  "Der Submit muss den serverseitigen Quote-Konflikt gezielt behandeln.",
);
assert.match(
  wizard,
  /sameCustomerPrice/,
  "Ein automatischer Wiederholungsversuch darf nur bei unveraendertem Kundenpreis erfolgen.",
);
assert.match(
  wizard,
  /const submissionSegments = completionSegments\.map\(\(segment\) => \(\{ \.\.\.segment, points: \[\.\.\.segment\.points\] \}\)\)/,
  "Der Submit muss den unmittelbar bestaetigten Gebietssnapshot einfrieren.",
);
assert.match(
  wizard,
  /buildOrderPayload\(completionPath, \{ \.\.\.submissionOptions, quoteFingerprint \}\)/,
  "Der Auftrag muss aus demselben Snapshot wie die Quote aufgebaut werden.",
);
assert.match(
  recovery,
  /export function sameCustomerPrice/,
  "Die Preisgleichheitspruefung muss zentral und testbar sein.",
);

console.log("Customer stale quote recovery checks passed.");
