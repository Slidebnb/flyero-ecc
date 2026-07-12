import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const baseUrl = process.env.PASSWORD_RESET_BASE_URL || "http://localhost:3000";
const email = "kunde.immobilien@example.com";
const oldPassword = "DemoPasswort123!";
const newPassword = "ResetPasswort456!";

function cookieHeader(response) {
  return (response.headers.get("set-cookie") || "").split(/,(?=[^;,]+=)/).map((item) => item.split(";")[0]).join("; ");
}

async function json(response) {
  return response.json();
}

const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, status: true } });
assert(user, "Seed-Kunde fuer Passwort-Reset fehlt.");
const originalHash = user.passwordHash;

try {
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.authRateLimitBucket.deleteMany();

  const unknownResponse = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "does-not-exist@example.com" }),
  });
  const unknownBody = await json(unknownResponse);
  assert.equal(unknownResponse.status, 200);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: oldPassword }),
  });
  assert.equal(loginResponse.status, 200, `Login vor Reset fehlgeschlagen: ${await loginResponse.text()}`);
  const oldCookie = cookieHeader(loginResponse);

  const requestResponse = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "password-reset-smoke" },
    body: JSON.stringify({ email }),
  });
  const requestBody = await json(requestResponse);
  assert.equal(requestResponse.status, 200);
  assert.equal(requestBody.data.message, unknownBody.data.message, "Reset-Anfrage verrät, ob ein Konto existiert.");

  const issuedTokenRow = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, usedAt: null }, orderBy: { createdAt: "desc" } });
  assert(issuedTokenRow, "Reset-Token wurde nicht gespeichert.");
  const issuedToken = await prisma.passwordResetToken.findUnique({ where: { id: issuedTokenRow.id }, select: { tokenHash: true } });
  assert(issuedToken && issuedToken.tokenHash.length === 64, "Reset-Token muss als SHA-256-Hash gespeichert werden.");
  await prisma.passwordResetToken.delete({ where: { id: issuedTokenRow.id } });

  const rawToken = randomBytes(32).toString("base64url");
  const manualTokenRow = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  const resetResponse = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "password-reset-smoke" },
    body: JSON.stringify({ token: rawToken, password: newPassword }),
  });
  assert.equal(resetResponse.status, 200, `Passwort-Reset fehlgeschlagen: ${await resetResponse.text()}`);
  const resetRow = await prisma.passwordResetToken.findUnique({ where: { id: manualTokenRow.id }, select: { usedAt: true } });
  assert(resetRow?.usedAt, "Reset-Token wurde nicht als verwendet markiert.");

  const revokedResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: oldCookie } });
  assert.equal(revokedResponse.status, 401, "Bestehende Session wurde nach Passwortänderung nicht widerrufen.");

  const newLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: newPassword }),
  });
  assert.equal(newLoginResponse.status, 200, `Login mit neuem Passwort fehlgeschlagen: ${await newLoginResponse.text()}`);

  const replayResponse = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: rawToken, password: oldPassword }),
  });
  assert.equal(replayResponse.status, 400, "Ein Reset-Token darf mehrfach verwendet werden.");

  const audit = await prisma.auditLog.findFirst({ where: { action: "auth.password_reset", userId: user.id }, orderBy: { createdAt: "desc" }, select: { requestId: true, result: true } });
  assert.equal(audit?.result, "SUCCESS", "Passwortänderung wurde nicht erfolgreich auditiert.");
  assert.equal(audit?.requestId, "password-reset-smoke", "Request-ID fehlt im Passwort-Reset-Audit.");

  console.log("Password reset live smoke passed.");
} finally {
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: originalHash, status: user.status } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.authSession.deleteMany({ where: { userId: user.id } });
  await prisma.authRateLimitBucket.deleteMany();
  await prisma.$disconnect();
}
