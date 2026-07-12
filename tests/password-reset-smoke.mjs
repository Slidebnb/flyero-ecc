import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  schema: "prisma/schema.prisma",
  requestRoute: "src/app/api/auth/request-password-reset/route.ts",
  resetRoute: "src/app/api/auth/reset-password/route.ts",
  mail: "src/lib/verificationEmail.ts",
  requestPage: "src/app/password-reset/page.tsx",
  resetPage: "src/app/reset-password/page.tsx",
  loginForm: "src/app/login/LoginForm.tsx",
};

const contents = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")]))
);

assert.match(contents.schema, /model PasswordResetToken/);
assert.match(contents.schema, /tokenHash\s+String\s+@unique/);
assert.match(contents.schema, /expiresAt\s+DateTime/);
assert.match(contents.schema, /usedAt\s+DateTime\?/);
assert.match(contents.requestRoute, /enforceAuthRateLimit\(request, "password-reset"\)/);
assert.match(contents.requestRoute, /Wenn zu dieser E-Mail/);
assert.match(contents.requestRoute, /auditRequestContext\(request\)/);
assert.match(contents.resetRoute, /hashVerificationToken/);
assert.match(contents.resetRoute, /revokeSession|authSession/);
assert.match(contents.resetRoute, /auth\.password_reset/);
assert.match(contents.mail, /sendPasswordResetEmail/);
assert.match(contents.requestPage, /Passwort/);
assert.match(contents.resetPage, /Passwort/);
assert.match(contents.loginForm, /password-reset/);

console.log("Password reset smoke checks passed.");
