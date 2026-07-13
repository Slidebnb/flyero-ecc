import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/app/api/health/route.ts", "utf8");
assert(source.includes("try {"), "Health-Endpoint hat keinen Fail-safe-Guard.");
assert(source.includes("HealthStatus.DOWN"), "Health-Endpoint kennt keinen DOWN-Fallback.");
assert(source.includes("status: 503"), "Health-Endpoint liefert bei DOWN keinen HTTP-503-Status.");
assert(source.includes('"Cache-Control": "no-store"'), "Health-Endpoint setzt keinen No-Store-Cache.");

console.log("Health fail-safe smoke checks passed.");
