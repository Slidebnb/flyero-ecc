import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  assert.ok(existsSync(path), `${path} fehlt.`);
  return readFileSync(path, "utf8");
}

const schema = read("prisma/schema.prisma");
const segments = read("src/lib/orderSegments.ts");
const smartMaps = read("src/lib/smartMaps.ts");
const orderRoute = read("src/app/api/customer/orders/route.ts");
const wizard = read("src/app/customer/orders/new/SmartOrderWizard.tsx");
const areaRoute = read("src/app/api/orders/[id]/area/route.ts");
const repeatRoute = read("src/app/api/customer/orders/[id]/repeat/route.ts");

assert.match(schema, /model OrderDistributionSegment/);
assert.match(schema, /distributionSegments\s+OrderDistributionSegment\[\]/);
assert.match(schema, /segmentId\s+String\?/);

for (const snippet of ["normalizeOrderAreaSegments", "aggregateOrderAreaSegments", "segments"]) {
  assert.match(segments, new RegExp(snippet), `Segment-Helfer fehlt: ${snippet}`);
}

assert.match(smartMaps, /segments\?:/);
assert.match(smartMaps, /order-area-v2-multi-segment/);
assert.match(smartMaps, /needsManualReview/);
assert.match(orderRoute, /areaSegments/);
assert.match(orderRoute, /prisma\.\$transaction/);
assert.match(wizard, /areaSegments/);
assert.match(wizard, /Teilgebiet hinzuf/);
assert.match(areaRoute, /segments/);
assert.match(repeatRoute, /areaSegments/);

console.log("Multi-area order contract checks passed.");
