import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const baseUrl = process.env.MAPS_ABUSE_BASE_URL || "http://localhost:3000";
const mapIp = "198.51.100.241";
const bucketId = createHash("sha256").update(`flyero-public-rate-limit:maps:${mapIp}`).digest("hex");

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

try {
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
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: bucketId } });
  await prisma.$disconnect();
}
