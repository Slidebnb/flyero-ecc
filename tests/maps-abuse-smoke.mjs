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
let baseUrl = sharedBaseUrl || `http://localhost:${port}`;
const mapIp = "198.51.100.241";
const bucketId = createHash("sha256").update(`flyero-public-rate-limit:maps:${mapIp}`).digest("hex");
let server = null;

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

const [protection, autocomplete, geocode, intelligence] = await Promise.all([
  readFile("src/lib/publicAbuseProtection.ts", "utf8"),
  readFile("src/app/api/maps/autocomplete/route.ts", "utf8"),
  readFile("src/app/api/maps/geocode/route.ts", "utf8"),
  readFile("src/app/api/maps/order-intelligence/route.ts", "utf8"),
]);

assert.match(protection, /"maps"/);
assert.match(protection, /PUBLIC_MAPS/);
for (const route of [autocomplete, geocode, intelligence]) {
  assert.match(route, /enforcePublicRateLimit\(request, "maps"\)/);
  assert.match(route, /publicRateLimitResponse/);
}

async function startServer() {
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
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.234" },
    body: JSON.stringify({ email: "kunde.immobilien@example.com", password: "DemoPasswort123!" }),
  });
  assert.equal(login.status, 200, `Kundenlogin fuer Maps-Smoke fehlgeschlagen: ${login.status}`);
  const cookie = cookieHeaderFrom(login);

  const responses = [];
  for (let attempt = 0; attempt < 61; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/maps/autocomplete?q=`, {
      headers: { cookie, "x-forwarded-for": mapIp },
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
  await prisma.$disconnect();
}
