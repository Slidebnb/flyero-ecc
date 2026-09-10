import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const customer = await readFile("src/app/api/auth/register-customer/route.ts", "utf8");
const distributor = await readFile("src/app/api/auth/register-distributor/route.ts", "utf8");
const resend = await readFile("src/app/api/auth/resend-verification/route.ts", "utf8");
const adminResend = await readFile("src/app/api/admin/customers/[id]/emails/resend/route.ts", "utf8");
const verification = await readFile("src/lib/verificationEmail.ts", "utf8");
const loginPage = await readFile("src/app/login/page.tsx", "utf8");

assert.doesNotMatch(customer, /createNotification\(/, "Die Registrierung darf keine unvollständige Willkommensmail erzeugen.");
assert.doesNotMatch(distributor, /createNotification\(/, "Die Verteilerregistrierung darf keine unvollständige Willkommensmail erzeugen.");
assert.match(customer, /sendVerificationEmail\([\s\S]*customerName/);
assert.match(verification, /action: \{ label: "E-Mail-Adresse best\\u00e4tigen", url: verifyUrl \}/);
assert.match(resend, /sendVerificationEmail\(\{ email: user\.email, token: verificationToken/);
assert.match(resend, /tokenHash: \{ not: hashVerificationToken\(verificationToken\) \}/);
assert.match(adminResend, /tokenHash: \{ not: hashVerificationToken\(verificationToken\) \}/);
assert.match(loginPage, /verificationEmailSent/);
assert.match(loginPage, /Spam-Ordner/);
console.log("Registration verification regression smoke passed.");
