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
  /orderId_distributorId_segmentId:/,
  "Der Seed muss den aktuellen Mehrgebiets-Unique-Key verwenden.",
);
assert.match(
  seed,
  /segmentId:\s*null/,
  "Ein Seed ohne Teilgebiet muss segmentId explizit auf null setzen.",
);

console.log("Seed dispatch recommendation linkage checks passed.");
