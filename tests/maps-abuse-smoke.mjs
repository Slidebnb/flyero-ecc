import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const port = process.env.MAPS_ABUSE_PORT || "3044";
const sharedBaseUrl = process.env.MAPS_ABUSE_BASE_URL || "";
let baseUrl = sharedBaseUrl || "http://localhost:3000";
const mapIp = process.env.MAPS_ABUSE_IP || `198.51.100.${(Date.now() % 200) + 20}`;
const authIp = `198.51.100.${(Date.now() % 200) + 220}`;
const bucketId = createHash("sha256").update(`flyero-public-rate-limit:public-planner-autocomplete:ip:${mapIp}`).digest("hex");
const authIpBucketId = createHash("sha256").update(`flyero-auth-rate-limit:login:ip:${authIp}`).digest("hex");
const authAccountBucketId = createHash("sha256").update("flyero-auth-rate-limit:login:account:kunde.immobilien@example.com").digest("hex");
let server = null;

const [protection, autocomplete, geocode, intelligence, boundary] = await Promise.all([
  readFile("src/lib/publicAbuseProtection.ts", "utf8"),
  readFile("src/app/api/maps/autocomplete/route.ts", "utf8"),
  readFile("src/app/api/maps/geocode/route.ts", "utf8"),
  readFile("src/app/api/maps/order-intelligence/route.ts", "utf8"),
  readFile("src/app/api/maps/boundary-area/route.ts", "utf8"),
]);

for (const scope of ["maps-autocomplete", "maps-geocode", "maps-intelligence", "maps-boundary"]) assert.match(protection, new RegExp(`"${scope}"`));
assert.match(protection, /PUBLIC_MAPS_AUTOCOMPLETE/);
assert.match(protection, /PUBLIC_MAPS_GEOCODE/);
assert.match(protection, /PUBLIC_MAPS_INTELLIGENCE/);
assert.match(protection, /PUBLIC_MAPS_BOUNDARY/);
for (const [route, publicScope, customerScope] of [
  [autocomplete, "maps-autocomplete", "customer-maps-autocomplete"],
  [geocode, "maps-geocode", "customer-maps-geocode"],
  [intelligence, "maps-intelligence", "customer-maps-intelligence"],
  [boundary, "maps-boundary", ""],
]) {
  assert.match(route, new RegExp(`"${publicScope}"`));
  assert.match(route, /publicRateLimitResponse/);
  if (customerScope) {
    assert.match(route, new RegExp(`"${customerScope}"`));
    assert.match(route, /customerRateLimitResponse/);
  }
}

async function startServer() {
  for (const candidate of [baseUrl, `http://localhost:${port}`]) {
    try {
      const response = await fetch(`${candidate}/api/health`);
      if (response.status < 500) {
        baseUrl = candidate;
        return;
      }
    } catch {
      // Kein bestehender Testserver erreichbar.
    }
  }

  baseUrl = `http://localhost:${port}`;
  server = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, EMAIL_PROVIDER: "mock", PORT: port },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.status < 500) return;
    } catch {
      // Server bootet noch.
    }
  }
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else server.kill();
  server = null;
  throw new Error(`Maps-Abuse-Testserver auf ${baseUrl} konnte nicht gestartet werden.`);
}

try {
  if (!sharedBaseUrl) await startServer();
  // A prior interrupted run may leave the dynamically selected bucket behind.
  // Reset only this smoke test's own identity before asserting the threshold.
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: bucketId } });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": authIp },
    body: JSON.stringify({ email: "kunde.immobilien@example.com", password: "DemoPasswort123!" }),
  });
  assert.equal(login.status, 200, `Kundenlogin fuer Maps-Smoke fehlgeschlagen: ${login.status}`);

  const responses = [];
  for (let attempt = 0; attempt < 61; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/public/planner/autocomplete?q=`, {
      headers: { "x-forwarded-for": mapIp },
    });
    responses.push(response.status);
  }
  assert.deepEqual(responses.slice(0, 60), Array.from({ length: 60 }, () => 200), "Maps-Abfragen werden unerwartet frueh blockiert.");
  assert.equal(responses[60], 429, "Maps-Rate-Limit greift nicht.");
  assert.ok(await prisma.publicRateLimitBucket.findUnique({ where: { id: bucketId } }), "Maps-Rate-Limit-Bucket wurde nicht gespeichert.");
  console.log("Maps abuse smoke checks passed.");
} finally {
  if (server) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else server.kill();
  }
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: bucketId } });
  await prisma.authRateLimitBucket.deleteMany({ where: { id: { in: [authIpBucketId, authAccountBucketId] } } });
  await prisma.$disconnect();
}
