import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/maps/order-intelligence/route.ts", "utf8");

assert.match(
  route,
  /serviceType:\s*serviceType,/, 
  "Die Vorschau-API muss den vom Wizard gewaehlten Service-Typ an die serverseitige Berechnung weitergeben.",
);
assert.match(
  route,
  /const serviceType\s*=\s*\(Object\.values\(ServiceType\) as string\[\]\)\.includes\(requestedServiceType \?\? ""\)/,
  "Der Service-Typ aus der URL muss vor der Berechnung gegen die erlaubte Service-Liste geprueft werden.",
);
assert.match(
  route,
  /params\.get\("areaDifficulty"\) \?\? params\.get\("clientDifficultyHint"\)/,
  "Die Vorschau muss den gleichen Schwierigkeits-Hinweis wie der Auftrag verwenden.",
);

console.log("Customer order intelligence service parity checks passed.");
