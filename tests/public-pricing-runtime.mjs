import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const port = process.env.PUBLIC_PRICING_TEST_PORT || "3039";
let baseUrl = process.env.PUBLIC_PRICING_BASE_URL || "http://localhost:3000";
let child = null;

async function waitForServer() {
  try {
    if ((await fetch(`${baseUrl}/api/health`)).ok) return;
  } catch {
    // Der konfigurierte Server ist noch nicht verfuegbar.
  }
  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  baseUrl = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Server bootet noch.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Testserver wurde nicht erreichbar.");
}

try {
  await waitForServer();
  const pricingPage = await fetch(`${baseUrl}/preise`);
  assert.equal(pricingPage.status, 200);
  const pricingHtml = await pricingPage.text();
  assert.match(pricingHtml, /Netto/);
  assert.match(pricingHtml, /MwSt/);
  assert.match(pricingHtml, /Brutto/);

  for (const [quantity, expectedMinimum] of [[500, 599], [3000, 1140], [10000, 3600]]) {
    const response = await fetch(`${baseUrl}/api/public/planner/quote`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${quantity % 200 + 20}` },
      body: JSON.stringify({
        city: "Koblenz",
        postalCode: "56068",
        flyerQuantity: quantity,
        coverageAreaSqm: 100000,
        flyerSource: "CUSTOMER_OWN",
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, `Preisquote ${quantity} konnte nicht berechnet werden: ${JSON.stringify(body)}`);
    assert.equal(Number(body.data.quote.net), expectedMinimum, `Preis ${quantity} kommt nicht aus der aktiven Pricing-Engine.`);
    assert.ok(Number(body.data.quote.vat) > 0);
    assert.equal(Number(body.data.quote.gross), Number(body.data.quote.net) + Number(body.data.quote.vat));
    assert.ok(body.data.quote.pricingVersion);
  }
  console.log("Public pricing runtime checks passed.");
} finally {
  if (child) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill();
  }
}
