import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = fs.readFileSync("src/lib/serviceCatalog.ts", "utf8");
const wizard = fs.readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const businessPage = fs.readFileSync("src/app/fuer-unternehmen/page.tsx", "utf8");

for (const serviceType of ["FLYER_DISTRIBUTION", "DOOR_HANGER", "BROCHURE", "MAGAZINE"]) {
  assert.match(catalog, new RegExp(serviceType));
}
assert.match(catalog, /Warenproben & Sampling/);
assert.match(catalog, /bookingAvailable: false/);
assert.match(wizard, /serviceCatalog/);
assert.match(wizard, /serviceType/);
assert.match(businessPage, /distributionServiceCatalog/);
console.log("service-catalog-smoke: ok");
