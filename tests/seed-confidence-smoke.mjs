import assert from "node:assert/strict";
import fs from "node:fs";

const smartMaps = fs.readFileSync(new URL("../src/lib/smartMaps.ts", import.meta.url), "utf8");

assert.match(
  smartMaps,
  /if \(method === "SEED" \|\| source\?\.toLowerCase\(\)\.includes\("seed"\)\) return "low" as const;/,
  "Seed-Haushaltsschätzungen müssen immer als niedrige Vertrauensstufe bewertet werden.",
);
assert.doesNotMatch(
  smartMaps,
  /if \(method === "SEED" \|\| source\?\.toLowerCase\(\)\.includes\("seed"\)\) return "medium" as const;/,
  "Seed-Haushaltsschätzungen dürfen nicht als mittlere Vertrauensstufe erscheinen.",
);

console.log("Seed confidence smoke passed");
