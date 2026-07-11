import assert from "node:assert/strict";

process.env.APP_URL = "https://flyero.org";

const { publicUrl } = await import("../src/lib/publicUrl.ts");

assert.equal(
  publicUrl("/admin/dashboard", "https://localhost:3000/api/auth/login").toString(),
  "https://flyero.org/admin/dashboard",
);

assert.equal(
  publicUrl("//evil.example", "https://localhost:3000/api/auth/login").toString(),
  "https://flyero.org/",
);

console.log("Public URL smoke checks passed.");
