import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import "dotenv/config";

const baseUrl = process.env.CSRF_ORIGIN_BASE_URL || "http://localhost:3000";
const source = await readFile("src/lib/request.ts", "utf8");
assert.match(source, /assertSameOrigin/);
assert.match(source, /headers\.get\("origin"\)/);

function cookieHeaderFrom(response) {
  return (response.headers.get("set-cookie") || "")
    .split(/,(?=[^;,]+=)/)
    .map((item) => item.split(";")[0])
    .join("; ");
}

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.101" },
  body: JSON.stringify({ email: "kunde.immobilien@example.com", password: "DemoPasswort123!" }),
});
assert.equal(login.status, 200, `Login fuer CSRF-Smoke fehlgeschlagen: ${login.status}`);
const cookie = cookieHeaderFrom(login);

const foreign = await fetch(`${baseUrl}/api/customer/orders`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://evil.example",
    cookie,
  },
  body: "{}",
});
assert.equal(foreign.status, 403, `Fremde Origin wurde nicht blockiert: ${foreign.status}`);

const sameOrigin = await fetch(`${baseUrl}/api/customer/orders`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: new URL(baseUrl).origin,
    cookie,
  },
  body: "{}",
});
assert.notEqual(sameOrigin.status, 403, `Erlaubte Origin wurde blockiert: ${sameOrigin.status}`);

console.log("CSRF origin smoke checks passed.");
