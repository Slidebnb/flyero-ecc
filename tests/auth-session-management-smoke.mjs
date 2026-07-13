import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const baseUrl = process.env.AUTH_SESSION_MANAGEMENT_BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

function cookieHeaderFrom(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function login(ip) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ email: "kunde.immobilien@example.com", password: "DemoPasswort123!" }),
  });
  assert.equal(response.status, 200, `Login fehlgeschlagen: ${response.status}`);
  return cookieHeaderFrom(response);
}

const route = await readFile("src/app/api/auth/sessions/route.ts", "utf8");
const auth = await readFile("src/lib/auth.ts", "utf8");
assert.match(route, /requireSession/);
assert.match(route, /revokeOtherSessions/);
assert.match(auth, /listUserSessions/);
assert.match(auth, /revokeOtherSessions/);

try {
  const firstCookie = await login("198.51.100.242");
  const secondCookie = await login("198.51.100.243");

  const sessions = await fetch(`${baseUrl}/api/auth/sessions`, { headers: { cookie: firstCookie } });
  assert.equal(sessions.status, 200, `Sitzungsliste lieferte ${sessions.status}.`);
  const sessionPayload = await sessions.json();
  assert.ok(Array.isArray(sessionPayload.data), "Sitzungsliste fehlt.");
  assert.ok(sessionPayload.data.length >= 2, "Zwei aktive Testsitzungen fehlen.");

  const revoke = await fetch(`${baseUrl}/api/auth/sessions`, {
    method: "POST",
    headers: { cookie: firstCookie, accept: "application/json" },
  });
  assert.equal(revoke.status, 200, `Sitzungswiderruf lieferte ${revoke.status}.`);
  const revokePayload = await revoke.json();
  assert.ok(revokePayload.data.revokedCount >= 1, "Keine fremde Sitzung wurde widerrufen.");

  const secondMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: secondCookie } });
  assert.equal(secondMe.status, 401, "Die zweite Sitzung bleibt trotz Widerruf aktiv.");
  const firstMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: firstCookie } });
  assert.equal(firstMe.status, 200, "Die aktuelle Sitzung wurde ungewollt mit widerrufen.");
  console.log("Auth session management smoke checks passed.");
} finally {
  await prisma.$disconnect();
}
