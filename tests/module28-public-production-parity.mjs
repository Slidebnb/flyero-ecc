import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = process.env.MODULE28_PRODUCTION_PARITY_PORT || "3049";
const baseUrl = `http://127.0.0.1:${port}`;
const routes = [
  "/",
  "/verteilung-anfragen",
  "/verteilung-planen",
  "/preise",
  "/kontakt",
  "/so-funktionierts",
  "/fuer-unternehmen",
];
let child = null;

function textOf(response) {
  return response.text();
}

try {
  child = spawn(process.platform === "win32" ? process.execPath : "npm", process.platform === "win32"
    ? ["node_modules/next/dist/bin/next", "start", "-p", port]
    : ["run", "start", "--", "-p", port], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
  });
  child.unref();

  let ready = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Production server bootet noch.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(ready, true, "next start wurde nicht rechtzeitig erreichbar.");

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await textOf(response);
    assert.equal(response.status, 200, `${route} lieferte im Produktionsserver ${response.status}.`);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${route} muss im Produktionsserver genau eine H1 liefern.`);
    assert.match(html, /rel="canonical"/, `${route} braucht im Produktionsserver einen Canonical-Link.`);
    assert.doesNotMatch(html, /GPS-Spur gepr(?:ü|Ã¼)ft|Tour Koblenz|Zustellquote/, `${route} darf keine Fake-Nachweise rendern.`);
  }

  console.log("Module 28 production parity checks passed.");
} finally {
  if (child && !child.killed) child.kill();
}
