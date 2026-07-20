import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const baseUrl = process.env.PUBLIC_ABUSE_BASE_URL || "http://localhost:3000";
const ip = `198.51.100.${Date.now() % 200 + 20}`;
const bucketId = createHash("sha256").update(`flyero-public-rate-limit:lead:ip:${ip}`).digest("hex");
const verifyIp = `203.0.113.${Date.now() % 200 + 20}`;
const verifyBucketId = createHash("sha256").update(`flyero-public-rate-limit:report-verify:ip:${verifyIp}`).digest("hex");
const errorIp = `192.0.2.${Date.now() % 200 + 20}`;
const errorBucketId = createHash("sha256").update(`flyero-public-rate-limit:client-error:ip:${errorIp}`).digest("hex");

const [schema, protection, leadRoute, verifyRoute, errorRoute, retention] = await Promise.all([
  readFile("prisma/schema.prisma", "utf8"),
  readFile("src/lib/publicAbuseProtection.ts", "utf8"),
  readFile("src/app/api/leads/route.ts", "utf8"),
  readFile("src/app/api/reports/verify/[code]/route.ts", "utf8"),
  readFile("src/app/api/monitoring/client-error/route.ts", "utf8"),
  readFile("scripts/retention.mjs", "utf8"),
]);

assert.match(schema, /model PublicRateLimitBucket\s*\{/);
assert.match(protection, /prisma\.publicRateLimitBucket/);
assert.match(leadRoute, /await assertLeadSubmissionAllowed/);
assert.match(leadRoute, /publicRateLimitResponse/);
assert.match(verifyRoute, /enforcePublicRateLimit\(request, "report-verify"\)/);
assert.match(errorRoute, /enforcePublicRateLimit\(request, "client-error"\)/);
assert.match(errorRoute, /publicRateLimitResponse/);
assert.doesNotMatch(verifyRoute, /newValues: \{ found: Boolean\(report\), code \}/);
assert.match(retention, /publicRateLimitBucket/);

try {
  const responses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "", website: "" }),
    });
    responses.push(response.status);
  }

  assert.deepEqual(responses.slice(0, 5), [400, 400, 400, 400, 400], "Ungültige Leads müssen vor dem Limit validiert werden.");
  assert.equal(responses[5], 429, "Persistentes Lead-Rate-Limit greift nicht.");
  assert.ok(await prisma.publicRateLimitBucket.findUnique({ where: { id: bucketId } }), "Lead-Bucket wurde nicht gespeichert.");

  const verifyResponses = [];
  for (let attempt = 0; attempt < 31; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/reports/verify/not-a-real-code-${Date.now()}-${attempt}`, {
      headers: { "x-forwarded-for": verifyIp },
    });
    verifyResponses.push(response.status);
  }
  assert.equal(verifyResponses.filter((status) => status === 404).length, 30, "Report-Verifikation muss unbekannte Codes zunächst sauber ablehnen.");
  assert.equal(verifyResponses[30], 429, "Persistentes Report-Verify-Rate-Limit greift nicht.");
  assert.ok(await prisma.publicRateLimitBucket.findUnique({ where: { id: verifyBucketId } }), "Report-Verify-Bucket wurde nicht gespeichert.");

  const errorResponses = [];
  for (let attempt = 0; attempt < 31; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/monitoring/client-error`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": errorIp },
      body: JSON.stringify({ message: "abuse smoke" }),
    });
    errorResponses.push(response.status);
  }
  assert.equal(errorResponses.filter((status) => status === 200).length, 30, "Client-Fehler muessen bis zum Limit verarbeitet werden.");
  assert.equal(errorResponses[30], 429, "Persistentes Client-Error-Rate-Limit greift nicht.");
  assert.ok(await prisma.publicRateLimitBucket.findUnique({ where: { id: errorBucketId } }), "Client-Error-Bucket wurde nicht gespeichert.");
  console.log("Public abuse smoke checks passed.");
} finally {
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: { in: [bucketId, verifyBucketId, errorBucketId] } } });
  await prisma.errorLog.deleteMany({ where: { source: "app.error_boundary", message: "abuse smoke" } });
  await prisma.$disconnect();
}
