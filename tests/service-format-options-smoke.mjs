import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = fs.readFileSync("src/lib/serviceCatalog.ts", "utf8");
const wizard = fs.readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const materialStep = fs.readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const validators = fs.readFileSync("src/lib/validators.ts", "utf8");
const orderRoute = fs.readFileSync("src/app/api/customer/orders/route.ts", "utf8");

const expectedFormats = {
  FLYER_STANDARD: ["DIN Lang (99 × 210 mm)", "A5 Flyer", "A6 Flyer"],
  CATALOG_DISTRIBUTION: ["A4 Katalog", "A5 Katalog", "individuelles Katalogformat"],
  BROCHURE_MAGAZINE: ["A4 Broschüre/Magazin", "A5 Broschüre", "DIN Lang Broschüre"],
  VOUCHER_CARD: ["Gutscheinkarte", "Couponkarte", "Klappkarte"],
  POSTCARD_INVITATION: ["Postkarte A6", "Einladungskarte", "Klappkarte"],
  EVENT_INVITATION: ["Einladungskarte", "Eventflyer", "VIP-/Gästekarte"],
  COMMUNITY_PUBLICATION: ["Gemeindeblatt", "Vereinsheft", "Magazin"],
  MENU_DELIVERY_CARD: ["Speisekarte", "Lieferkarte", "Falzflyer Gastronomie"],
  PRODUCT_SAMPLING: ["Produktprobe", "Warenprobe", "Promotion-Set"],
};

for (const [serviceType, formats] of Object.entries(expectedFormats)) {
  const serviceBlock = new RegExp(`serviceType: "${serviceType}"[\\s\\S]*?formatOptions: \\[[\\s\\S]*?\\]`).exec(catalog)?.[0];
  assert.ok(serviceBlock, `${serviceType} braucht eigene Formatoptionen.`);
  for (const format of formats) {
    assert.ok(serviceBlock.includes(`"${format}"`), `${serviceType} fehlt das Format ${format}.`);
  }
}

assert.match(wizard, /const \[productFormat, setProductFormat\] = useState/);
assert.match(materialStep, /selectedService\.formatOptions/);
assert.match(materialStep, /value=\{productFormat\}/);
assert.match(wizard, /setProductFormat\(normalizeServiceProductFormat\(/);
assert.match(validators, /normalizeServiceProductFormat/);
assert.match(orderRoute, /productFormat: normalizeServiceProductFormat\(/);

console.log("service-format-options-smoke: ok");
