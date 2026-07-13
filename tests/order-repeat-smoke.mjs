import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  assert.ok(existsSync(path), `${path} fehlt.`);
  return readFileSync(path, "utf8");
}

const route = read("src/app/api/customer/orders/[id]/repeat/route.ts");
const wizard = read("src/app/customer/orders/new/SmartOrderWizard.tsx");
const detail = read("src/app/customer/orders/[id]/page.tsx");

assert.match(route, /requireTenantSession/);
assert.match(route, /tenantId/);
assert.match(route, /targetAreaGeoJson/);
assert.match(route, /flyerQuantity/);
assert.match(route, /draft/);
assert.match(wizard, /repeatFrom/);
assert.match(wizard, /\/api\/customer\/orders\//);
assert.match(detail, /Kampagne wiederholen/);
assert.doesNotMatch(route, /create\(\{/);
console.log("Order repeat contract checks passed.");
