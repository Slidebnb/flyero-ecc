import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const protection = readFileSync("src/lib/publicAbuseProtection.ts", "utf8");
const routes = [
  ["src/app/api/maps/autocomplete/route.ts", "customer-maps-autocomplete"],
  ["src/app/api/maps/geocode/route.ts", "customer-maps-geocode"],
  ["src/app/api/maps/order-intelligence/route.ts", "customer-maps-intelligence"],
];

for (const [file, scope] of routes) {
  const source = readFileSync(file, "utf8");
  assert.match(source, new RegExp(`"${scope}"`), `${file} braucht einen eigenen Kunden-Bucket.`);
  assert.match(source, /tenantId: .*session\.tenantId/, `${file} muss den Mandanten in den Bucket geben.`);
  assert.match(source, /userId: .*\b(?:baseSession|session)\.id/, `${file} muss den Nutzer in den Bucket geben.`);
}

assert.match(protection, /customer-maps-autocomplete/);
assert.match(protection, /customer-maps-geocode/);
assert.match(protection, /customer-maps-intelligence/);
assert.match(protection, /identity\?: \{ tenantId: string; userId: string \}/);
assert.match(protection, /tenantId:\$\{identity\.tenantId\}:userId:\$\{identity\.userId\}/);
assert.match(protection, /Die Suche ist gerade ausgelastet/);
console.log("Customer maps rate-limit smoke checks passed.");
