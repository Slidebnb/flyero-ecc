import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import "dotenv/config";

const baseUrl = process.env.PRICING_ADMIN_PROPAGATION_BASE_URL || "http://localhost:3000";
const password = "DemoPasswort123!";
let child = null;

async function waitForServer() {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (response.status < 500) return;
  } catch {}

  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: new URL(baseUrl).port || "3000" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status < 500) return;
    } catch {}
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer den Pricing-Propagation-Smoke nicht gestartet werden.");
}

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function login(email, ip) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `Login fehlgeschlagen: ${email} (${response.status})`);
  return cookieHeaderFrom(response);
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  assert.ok(response.status >= 200 && response.status < 300, `${options.method || "GET"} ${path} lieferte ${response.status}: ${text}`);
  return body;
}

function orderPayload() {
  return {
    serviceType: "FLYER_DISTRIBUTION",
    city: "Koblenz",
    postalCode: "56068",
    targetAreaName: "Pricing Propagation Smoke",
    areaType: "POLYGON",
    targetAreaGeoJson: JSON.stringify({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [[[7.58, 50.35], [7.59, 50.35], [7.59, 50.36], [7.58, 50.36], [7.58, 50.35]]] },
      }],
    }),
    coverageAreaSqm: 640000,
    estimatedHouseholds: 2400,
    estimatedFlyers: 2200,
    estimatedDistanceMeters: 4200,
    areaCalculationSnapshot: JSON.stringify({ calculationVersion: "order-area-v1", pricingVersion: "premium-distribution-v4" }),
    centerLat: 50.3569,
    centerLng: 7.589,
    flyerQuantity: 2000,
    flyerSource: "CUSTOMER_OWN",
    printDataStatus: "UPLOAD_LATER",
    completionPath: "inquiry",
    preferredStartDate: "2026-08-03",
    preferredEndDate: "2026-08-10",
    flexibleScheduling: true,
    contactPerson: "Pricing Smoke",
    contactPhone: "+49 261 123456",
    notes: "Pricing propagation smoke.",
  };
}

await waitForServer();
let adminCookie = "";
let originalRules = [];
try {
  adminCookie = await login("admin@example.com", "198.51.100.88");
  const customerCookie = await login("kunde.immobilien@example.com", "198.51.100.89");

  const initial = await requestJson("/api/admin/settings/pricing", { headers: { cookie: adminCookie } });
  originalRules = initial.data.rules.filter((rule) => rule.serviceType === "FLYER_DISTRIBUTION" && rule.isActive);
  assert.equal(originalRules.length, 3, "Drei Flyerverteilungsregeln fehlen.");

  const existingOrder = await requestJson("/api/customer/orders", {
    method: "POST",
    headers: { cookie: customerCookie },
    body: JSON.stringify(orderPayload()),
  });
  assert.equal(existingOrder.data.calculatedNetPrice, "760", "Ausgangspreis der bestehenden offenen Order ist unerwartet.");

  const modifiedRules = originalRules.map((rule) => rule.minQuantity === 1
    ? { ...rule, pricePerUnit: "1.00", basePrice: "0", minimumNetPrice: "0", isActive: true }
    : rule.minQuantity === 5001
      ? { ...rule, basePrice: "5000", isActive: true }
      : rule.minQuantity === 10001
        ? { ...rule, basePrice: "6700", isActive: true }
        : rule);
  await requestJson("/api/admin/settings/pricing", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ rules: modifiedRules }),
  });

  const propagated = await requestJson(`/api/customer/orders/${existingOrder.data.id}`, { headers: { cookie: customerCookie } });
  assert.equal(propagated.data.calculatedNetPrice, "2000", "Preisregel-Aenderung wurde nicht in eine offene Kunden-Order propagiert.");

  const intelligence = await requestJson("/api/maps/order-intelligence?city=Koblenz&postalCode=56068&coverageAreaSqm=640000&flyerQuantity=2000", {
    headers: { cookie: customerCookie },
  });
  assert.equal(intelligence.data.metrics.netPrice, "2000", "Kunden-Wizard verwendet die geaenderte Admin-Preisregel nicht.");

  const created = await requestJson("/api/customer/orders", {
    method: "POST",
    headers: { cookie: customerCookie },
    body: JSON.stringify(orderPayload()),
  });
  assert.equal(created.data.calculatedNetPrice, "2000", "Neue Order uebernimmt die Admin-Preisregel nicht.");

  await requestJson("/api/admin/settings/pricing", {
    method: "PATCH",
    headers: { cookie: adminCookie },
    body: JSON.stringify({ rules: originalRules }),
  });

  await requestJson("/api/payments/checkout", {
    method: "POST",
    headers: { cookie: customerCookie },
    body: JSON.stringify({ orderId: created.data.id }),
  });
  const refreshed = await requestJson(`/api/customer/orders/${created.data.id}`, { headers: { cookie: customerCookie } });
  assert.equal(refreshed.data.calculatedNetPrice, "760", "Checkout aktualisiert den offenen Preis-Snapshot nicht.");
  console.log("Pricing admin propagation smoke checks passed.");
} finally {
  if (adminCookie && originalRules.length) {
    await requestJson("/api/admin/settings/pricing", {
      method: "PATCH",
      headers: { cookie: adminCookie },
      body: JSON.stringify({ rules: originalRules }),
    }).catch(() => {});
  }
  if (child) child.kill();
}
