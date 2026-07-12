import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
let baseUrl = process.env.AUTH_ABUSE_BASE_URL || "http://localhost:3000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(path) {
  assert(existsSync(path), `${path} fehlt.`);
  return readFileSync(path, "utf8");
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 7000);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function ensureServer() {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/health`, { timeoutMs: 2500 });
    if (response.status < 500) return null;
  } catch {}

  const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: new URL(baseUrl).port || "3000" },
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await sleep(1000);
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/health`);
      if (response.status < 500) return child;
    } catch {}
  }
  child.kill();
  throw new Error("Dev-Server konnte fuer Auth-Abuse-Smoke nicht gestartet werden.");
}

const limiter = read("src/lib/authAbuseProtection.ts");
assert(limiter.includes("authRateLimitBucket"), "Auth-Abuse-Schutz muss DB-gestützt sein.");
assert(limiter.includes("retryAfterSeconds"), "Auth-Abuse-Schutz muss Retry-After liefern.");
for (const route of [
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/register-customer/route.ts",
  "src/app/api/auth/register-distributor/route.ts",
  "src/app/api/auth/resend-verification/route.ts",
  "src/app/api/auth/verify-email/route.ts",
]) {
  assert(read(route).includes("enforceAuthRateLimit"), `${route} verwendet keinen zentralen Auth-Limiter.`);
}

const userAgent = "flyero-auth-abuse-smoke";
const ip = "198.51.100.42";
const email = `auth-abuse-${Date.now()}@example.invalid`;
const server = await ensureServer();
try {
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": userAgent,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email, password: "falsches-passwort" }),
    });
    if (attempt === 10) {
      assert(response.status === 429, `Login-Limit greift nicht: ${response.status}`);
      assert(response.headers.get("retry-after"), "Login-Limit liefert keinen Retry-After-Header.");
    }
  }

  console.log("Auth-Abuse Smoke-Test erfolgreich abgeschlossen.");
} finally {
  if (prisma.authRateLimitBucket) {
    await prisma.authRateLimitBucket.deleteMany();
  }
  await prisma.$disconnect();
  if (server) server.kill();
}
