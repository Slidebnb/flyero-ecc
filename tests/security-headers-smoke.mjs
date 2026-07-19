import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [caddy, nextConfig] = await Promise.all([
  readFile("Caddyfile", "utf8"),
  readFile("next.config.ts", "utf8"),
]);

assert.match(caddy, /Strict-Transport-Security/, "Caddy muss HSTS setzen.");
assert.match(caddy, /Permissions-Policy/, "Caddy muss Permissions-Policy setzen.");
assert.match(caddy, /Content-Security-Policy/, "Caddy muss eine CSP setzen.");
assert.match(caddy, /frame-ancestors 'none'/, "CSP muss Clickjacking ueber frame-ancestors blockieren.");
assert.match(caddy, /object-src 'none'/, "CSP muss eingebettete Objekte blockieren.");
assert.match(caddy, /maps\.googleapis\.com/, "CSP muss Google Maps erlauben.");
assert.match(caddy, /connect-src[^;]*mapsresources-pa\.googleapis\.com/, "CSP muss die Google-Maps-Vector-Konfiguration erlauben.");
assert.match(caddy, /worker-src[^;]*blob:/, "CSP muss Google-Maps-Vector-Worker erlauben.");
assert.match(caddy, /js\.stripe\.com/, "CSP muss Stripe Checkout erlauben.");
assert.match(nextConfig, /poweredByHeader:\s*false/, "Next darf X-Powered-By nicht ausliefern.");

console.log("Security-Headers smoke ok");
