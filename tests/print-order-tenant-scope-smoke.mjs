import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const documents = await readFile("src/lib/documents.ts", "utf8");
assert.match(documents, /if \(isPlatformAdmin\(actor\)\) return \{\};/);
assert.match(documents, /if \(actor\.role === UserRole\.SUPPORT_DISPATCHER\) return tenantWhereForSession\(actor\);/);
assert.match(documents, /findFirst\(\{ where: \{ id, \.\.\.printScope\(actor\) \}/);

console.log("Print order tenant scope smoke checks passed.");
