import { existsSync, readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const quoteSource = readFileSync("src/lib/planningQuote.ts", "utf8");
const mapsSource = readFileSync("src/lib/smartMaps.ts", "utf8");
const orderSource = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
assert(existsSync("src/lib/planningQuote.ts"), "Zentrale Quote-Datei fehlt.");
for (const snippet of ["buildPlanningInputFingerprint", "PLANNING_QUOTE_VERSION", "pricingRuleSignature", "polygonHash"]) {
  assert(quoteSource.includes(snippet), `Quote-Vertrag fehlt: ${snippet}`);
}
for (const snippet of ["buildAuthoritativePlanningQuote", "calculateOrderPrice", "planningGeometry"]) {
  assert(mapsSource.includes(snippet), `Serverberechnung fehlt: ${snippet}`);
}
assert(orderSource.includes("data.quoteFingerprint !== intelligence.metrics.fingerprint"), "Order muss die Quote serverseitig vergleichen.");
assert(orderSource.includes('code: "PLANNING_QUOTE_CHANGED"'), "Stale-Quote-Code fehlt.");

const baseUrl = process.env.CORE_ORDER_BASE_URL;
if (baseUrl) {
  const segment = {
    name: "Quote-Testgebiet",
    city: "Koblenz",
    postalCode: "56068",
    geometryGeoJson: { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.35]]] } }] },
  };
  async function quote(flyerQuantity) {
    const response = await fetch(`${baseUrl}/api/public/planner/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ city: "Koblenz", postalCode: "56068", coverageAreaSqm: 640000, flyerQuantity, segments: [segment] }),
    });
    const data = await response.json();
    assert(response.ok, `Quote-API antwortete mit ${response.status}.`);
    return data.data.metrics;
  }
  const smaller = await quote(2000);
  const larger = await quote(3000);
  assert(smaller.fingerprint !== larger.fingerprint, "Flyerzahländerung muss eine neue Quote erzeugen.");
  assert(smaller.netPrice !== larger.netPrice, "Flyerzahländerung muss den serverseitigen Preis ändern.");
}

console.log("Order quote consistency checks passed.");
