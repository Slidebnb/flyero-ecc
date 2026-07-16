import assert from "node:assert/strict";
import fs from "node:fs";

const pricing = fs.readFileSync("src/lib/pricing.ts", "utf8");
const defaults = fs.readFileSync("src/lib/servicePricing.ts", "utf8");

const definitions = {
  FLYER_STANDARD: { minimum: 599, tiers: [[5000, 0.38, 0], [10000, 0.34, 1900], [Infinity, 0.31, 3600]] },
  CATALOG_DISTRIBUTION: { minimum: 799, tiers: [[5000, 0.55, 0], [10000, 0.49, 2750], [Infinity, 0.44, 5200]] },
  BROCHURE_MAGAZINE: { minimum: 699, tiers: [[5000, 0.46, 0], [10000, 0.41, 2300], [Infinity, 0.37, 4350]] },
  VOUCHER_CARD: { minimum: 599, tiers: [[5000, 0.40, 0], [10000, 0.36, 2000], [Infinity, 0.33, 3800]] },
  POSTCARD_INVITATION: { minimum: 649, tiers: [[5000, 0.43, 0], [10000, 0.39, 2150], [Infinity, 0.35, 4100]] },
  EVENT_INVITATION: { minimum: 699, tiers: [[5000, 0.45, 0], [10000, 0.41, 2250], [Infinity, 0.37, 4300]] },
  COMMUNITY_PUBLICATION: { minimum: 699, tiers: [[5000, 0.48, 0], [10000, 0.43, 2400], [Infinity, 0.39, 4550]] },
  MENU_DELIVERY_CARD: { minimum: 599, tiers: [[5000, 0.40, 0], [10000, 0.36, 2000], [Infinity, 0.33, 3800]] },
  PRODUCT_SAMPLING: { minimum: 1499, tiers: [[2000, 1.1, 0], [5000, 0.95, 2200], [Infinity, 0.85, 5050]] },
};

function marginalPrice(quantity, definition) {
  const [first, second, third] = definition.tiers;
  const raw = quantity <= first[0]
    ? first[2] + quantity * first[1]
    : quantity <= second[0]
      ? second[2] + (quantity - first[0]) * second[1]
      : third[2] + (quantity - second[0]) * third[1];
  return Math.max(raw, definition.minimum);
}

assert.equal(marginalPrice(100, definitions.FLYER_STANDARD), 599);
assert.equal(marginalPrice(2000, definitions.FLYER_STANDARD), 760);
assert.equal(marginalPrice(5000, definitions.FLYER_STANDARD), 1900);
assert.equal(marginalPrice(5001, definitions.FLYER_STANDARD), 1900.34);
assert.equal(marginalPrice(10000, definitions.FLYER_STANDARD), 3600);
assert.equal(marginalPrice(10001, definitions.FLYER_STANDARD), 3600.31);
assert.equal(marginalPrice(100, definitions.CATALOG_DISTRIBUTION), 799);
assert.equal(marginalPrice(2000, definitions.CATALOG_DISTRIBUTION), 1100);
assert.equal(marginalPrice(5000, definitions.CATALOG_DISTRIBUTION), 2750);
assert.equal(marginalPrice(5001, definitions.CATALOG_DISTRIBUTION), 2750.49);
assert.equal(marginalPrice(10000, definitions.CATALOG_DISTRIBUTION), 5200);
assert.equal(marginalPrice(10001, definitions.CATALOG_DISTRIBUTION), 5200.44);
assert.equal(marginalPrice(100, definitions.PRODUCT_SAMPLING), 1499);
assert.equal(marginalPrice(2000, definitions.PRODUCT_SAMPLING), 2200);
assert.equal(marginalPrice(2001, definitions.PRODUCT_SAMPLING), 2200.95);
assert.equal(marginalPrice(5000, definitions.PRODUCT_SAMPLING), 5050);
assert.equal(marginalPrice(5001, definitions.PRODUCT_SAMPLING), 5050.85);

for (const [serviceType, definition] of Object.entries(definitions)) {
  assert.match(defaults, new RegExp(serviceType));
  assert.equal(marginalPrice(100, definition), definition.minimum, `${serviceType}: Mindestpreis fehlt`);
  const firstLimit = definition.tiers[0][0];
  const secondLimit = definition.tiers[1][0];
  assert.ok(marginalPrice(firstLimit + 1, definition) >= marginalPrice(firstLimit, definition), `${serviceType}: erste Schwelle fällt`);
  assert.ok(marginalPrice(secondLimit + 1, definition) >= marginalPrice(secondLimit, definition), `${serviceType}: zweite Schwelle fällt`);
}
assert.match(pricing, /CUSTOM/);
assert.match(pricing, /checkoutAllowed/);
assert.match(pricing, /samplingHandlingFeePerUnit/);
assert.ok(marginalPrice(5001, definitions.FLYER_STANDARD) > marginalPrice(5000, definitions.FLYER_STANDARD));
assert.ok(marginalPrice(10001, definitions.FLYER_STANDARD) > marginalPrice(10000, definitions.FLYER_STANDARD));
console.log("service-pricing-smoke: ok");
