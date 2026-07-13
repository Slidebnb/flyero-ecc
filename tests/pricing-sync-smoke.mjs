import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile("scripts/sync-premium-pricing.mjs", "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

assert.equal(packageJson.scripts["pricing:sync-premium"], "node -r dotenv/config scripts/sync-premium-pricing.mjs");
assert.match(script, /basePrice: "1900"/);
assert.match(script, /basePrice: "3600"/);
assert.match(script, /pricePerUnit: "0\.38"/);
assert.match(script, /pricePerUnit: "0\.34"/);
assert.match(script, /pricePerUnit: "0\.31"/);
assert.match(script, /minimumNetPrice: "599"/);
assert.doesNotMatch(script, /prisma\.migrate|deleteMany|reset/);

console.log("Pricing sync smoke checks passed.");
