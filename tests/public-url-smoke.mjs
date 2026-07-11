import assert from "node:assert/strict";

process.env.APP_URL = "https://flyero.org";

const { publicUrl } = await import("../src/lib/publicUrl.ts");
const registerCustomerRoute = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/app/api/auth/register-customer/route.ts", import.meta.url), "utf8"),
);
const registerDistributorRoute = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/app/api/auth/register-distributor/route.ts", import.meta.url), "utf8"),
);
const verifyEmailRoute = await import("node:fs/promises").then((fs) =>
  fs.readFile(new URL("../src/app/api/auth/verify-email/route.ts", import.meta.url), "utf8"),
);

assert.equal(
  publicUrl("/admin/dashboard", "https://localhost:3000/api/auth/login").toString(),
  "https://flyero.org/admin/dashboard",
);

assert.equal(
  publicUrl("//evil.example", "https://localhost:3000/api/auth/login").toString(),
  "https://flyero.org/",
);

for (const [name, source] of [
  ["register-customer", registerCustomerRoute],
  ["register-distributor", registerDistributorRoute],
  ["verify-email", verifyEmailRoute],
]) {
  assert.match(source, /publicUrl\("\/login"/, `${name} muss APP_URL fuer HTML-Redirects nutzen.`);
  assert.doesNotMatch(source, /new URL\("\/login", request\.url\)/, `${name} darf nicht request.url fuer Login-Redirects nutzen.`);
}

console.log("Public URL smoke checks passed.");
