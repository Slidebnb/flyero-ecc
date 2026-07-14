import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const verification = readFileSync("src/app/api/auth/verify-email/route.ts", "utf8");
const registration = readFileSync("src/app/api/auth/register-customer/route.ts", "utf8");
const resend = readFileSync("src/app/api/auth/resend-verification/route.ts", "utf8");

assert.match(schema, /model EmailVerificationToken[\s\S]*redirectPath\s+String\?/);
assert.match(registration, /safeInternalRedirectPath/);
assert.match(resend, /safeInternalRedirectPath/);
assert.match(verification, /redirectTo/);
assert.match(verification, /verificationToken\.redirectPath/);
assert.equal(existsSync("prisma/migrations/20260714100000_add_email_verification_redirect_path/migration.sql"), true);
console.log("Verification continuation contract passed.");
