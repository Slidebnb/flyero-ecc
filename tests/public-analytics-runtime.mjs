import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const port = process.env.PUBLIC_ANALYTICS_TEST_PORT || "3050";
let baseUrl = process.env.PUBLIC_ANALYTICS_BASE_URL || `http://localhost:${port}`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let child = null;
const requestId = `analytics-${randomUUID()}`;
const ip = `198.51.100.${(Date.now() % 150) + 50}`;
const bucketId = createHash("sha256").update(`flyero-public-rate-limit:public-experience:${ip}`).digest("hex");

async function ensureServer() {
  try {
    if ((await fetch(`${baseUrl}/api/health`)).ok) return;
  } catch {
    // Der Testserver wird unten gestartet.
  }
  const serverMode = existsSync(".next/BUILD_ID") ? "start" : "dev";
  child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", serverMode, "--", "-p", port], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: port, EMAIL_PROVIDER: "mock" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) return;
    } catch {
      // Server bootet noch.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server unter ${baseUrl} ist nicht erreichbar.`);
}

try {
  await ensureServer();
  const eventTypes = ["PUBLIC_INQUIRY_STARTED", "PUBLIC_INQUIRY_COMPLETED", "PUBLIC_INQUIRY_FAILED"];
  for (const eventType of eventTypes) {
    const response = await fetch(`${baseUrl}/api/public/planner/experience`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ eventType, requestId, analyticsSource: "public-inquiry" }),
    });
    assert.equal(response.status, 201, `${eventType} muss über die echte Public-Experience-API gespeichert werden.`);
  }

  const events = await prisma.orderExperienceEvent.findMany({
    where: {
      source: "public-inquiry",
      metadata: { path: ["requestId"], equals: requestId },
    },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    new Set(events.map((event) => event.eventType)),
    new Set(eventTypes),
    "Inquiry-Analytics müssen vollständig und ohne Formularinhalte gespeichert werden.",
  );
  assert.equal(events.every((event) => event.city === null && event.postalCode === null), true);
  console.log("Public analytics runtime checks passed.");
} finally {
  await prisma.orderExperienceEvent.deleteMany({
    where: { source: "public-inquiry", metadata: { path: ["requestId"], equals: requestId } },
  }).catch(() => undefined);
  await prisma.publicRateLimitBucket.deleteMany({ where: { id: bucketId } }).catch(() => undefined);
  await prisma.$disconnect();
  if (child) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    else child.kill();
  }
}
