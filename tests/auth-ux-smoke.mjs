import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const loginPage = await text("src/app/login/page.tsx");
const loginForm = await text("src/app/login/LoginForm.tsx");
const registerPage = await text("src/app/register/customer/page.tsx");
const registerForm = await text("src/app/register/customer/CustomerRegisterForm.tsx");
const verifyPage = await text("src/app/verify-email/page.tsx");
const verifyForm = await text("src/app/verify-email/VerifyEmailForm.tsx");
const loginRoute = await text("src/app/api/auth/login/route.ts");
const resendRoute = await text("src/app/api/auth/resend-verification/route.ts");
const registerRoute = await text("src/app/api/auth/register-customer/route.ts");
const emailHelper = await text("src/lib/verificationEmail.ts");

assert.match(loginPage, /<LoginForm next=\{next\} \/>/, "Login page must use the client LoginForm.");
assert.doesNotMatch(loginPage, /action="\/api\/auth\/login"/, "Login page must not post directly to the API.");
assert.match(loginForm, /fetch\("\/api\/auth\/login"/, "Login form must submit through fetch.");
assert.match(loginForm, /EMAIL_UNVERIFIED/, "Login form must handle unverified accounts.");
assert.match(loginForm, /\/api\/auth\/resend-verification/, "Login form must offer resend verification.");

assert.match(registerPage, /<CustomerRegisterForm next=\{next\} \/>/, "Customer register page must use the client form.");
assert.doesNotMatch(registerPage, /action="\/api\/auth\/register-customer"/, "Register page must not post directly to the API.");
assert.match(registerForm, /\/api\/auth\/register-customer/, "Register form must submit through fetch.");
assert.match(registerForm, /\/api\/auth\/resend-verification/, "Register form must offer resend verification.");
assert.match(registerForm, /role=\"dialog\"/, "Registration success must be shown in a dialog.");
assert.match(registerForm, /aria-modal=\"true\"/, "Registration dialog must be announced as modal.");
assert.doesNotMatch(registerForm, /name=\"billingStreet\" required/, "Billing address must be completable after the first quote.");
assert.doesNotMatch(registerForm, /name=\"billingPostalCode\" required/, "Billing address must be completable after the first quote.");
assert.doesNotMatch(registerForm, /name=\"billingCity\" required/, "Billing address must be completable after the first quote.");

assert.match(verifyPage, /<VerifyEmailForm initialToken=\{params\.token \|\| ""\} \/>/, "Verify page must use the client form.");
assert.doesNotMatch(verifyPage, /action="\/api\/auth\/verify-email"/, "Verify page must not post directly to the API.");
assert.match(verifyForm, /\/api\/auth\/verify-email/, "Verify form must submit through fetch.");
assert.match(verifyForm, /\/api\/auth\/resend-verification/, "Verify form must offer resend verification.");

assert.match(loginRoute, /code:\s*"EMAIL_UNVERIFIED"/, "Login API must return a machine-readable unverified code.");
assert.match(resendRoute, /createEmailVerificationToken/, "Resend route must create a fresh verification token.");
assert.match(resendRoute, /sendVerificationEmail/, "Resend route must send the verification email.");
assert.match(registerRoute, /sendVerificationEmail/, "Customer registration must send a verification email.");
assert.match(emailHelper, /publicUrl\(`\/verify-email\?token=/, "Verification email must use the public URL helper.");

for (const [name, content] of [
  ["loginPage", loginPage],
  ["registerPage", registerPage],
  ["verifyPage", verifyPage],
  ["resendRoute", resendRoute],
]) {
  assert.doesNotMatch(content, /Ã|Â/, `${name} must not contain mojibake.`);
}

console.log("auth-ux smoke ok");
