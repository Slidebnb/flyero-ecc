import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("prisma/schema.prisma", "utf8");
const seed = await readFile("prisma/seed.mjs", "utf8");

assert.match(
  schema,
  /@@unique\(\[orderId, distributorId, segmentId\]\)/,
  "Auto-Dispatch-Empfehlungen brauchen den Mehrgebiets-Unique-Key.",
);
assert.match(
  seed,
  /segmentId:\s*null/,
  "Ein Seed ohne Teilgebiet muss segmentId explizit auf null setzen.",
);
assert.match(
  seed,
  /autoDispatchRecommendation\.findFirst\(/,
  "Nullable segmentId darf nicht als Prisma-Compound-Key verwendet werden.",
);
assert.match(
  seed,
  /existingRecommendation\.id/,
  "Bestehende Empfehlungen ohne Teilgebiet müssen per ID aktualisiert werden.",
);
assert.doesNotMatch(
  seed,
  /orderId_distributorId_segmentId:\s*\{[\s\S]*?segmentId:\s*null/,
  "Prisma darf segmentId null nicht in einem Compound-Where erhalten.",
);

console.log("Seed dispatch recommendation linkage checks passed.");
