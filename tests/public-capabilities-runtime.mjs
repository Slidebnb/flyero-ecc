import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const port = process.env.PUBLIC_CAPABILITIES_TEST_PORT || "3040";
let baseUrl = process.env.PUBLIC_CAPABILITIES_BASE_URL || "http://localhost:3000";
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
  for (const path of ["/", "/verteilung-anfragen", "/preise", "/kontakt", "/so-funktionierts", "/fuer-unternehmen", "/fuer-verteiler"]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} ist nicht erreichbar.`);
    const html = await response.text();
    assert.doesNotMatch(html, /GPS-Nachweis aktiv|Tour Koblenz|Zustellquote geprüft|GPS-Punkte, Fotos, Zeiten/);
    assert.doesNotMatch(html, /Druckoption wählen|Druck und Verteilung können im Ablauf zusammen geplant/);
  }
  const home = await (await fetch(`${baseUrl}/`)).text();
  assert.match(home, /So bleibt deine Verteilung nachvollziehbar/);
  assert.match(home, /Druck wird aktuell separat mit FLYERO besprochen/);
  const inquiry = await (await fetch(`${baseUrl}/verteilung-anfragen`)).text();
  assert.match(inquiry, /Direkt online buchen/);
  assert.match(inquiry, /Unverbindlich anfragen/);
  assert.match(inquiry, /Anfrageformular nutzen/);
  assert.match(inquiry, /postalCode/);

  const printQuote = await fetch(`${baseUrl}/api/public/planner/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.241" },
    body: JSON.stringify({
      city: "Lahnstein",
      postalCode: "56112",
      flyerQuantity: 500,
      coverageAreaSqm: 100000,
      flyerSource: "PRINT_SERVICE",
    }),
  });
  const printBody = await printQuote.json();
  assert.equal(printQuote.status, 422);
  assert.match(printBody.error, /Druck wird aktuell separat/);
  console.log("Public capabilities runtime checks passed.");
} finally {
  if (child) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill();
  }
}
