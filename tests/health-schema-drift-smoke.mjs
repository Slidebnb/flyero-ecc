import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("src/app/api/health/route.ts", "utf8");

assert.match(source, /prisma\.auditLog\.findFirst\([\s\S]*integrityHash/, "Health-Endpoint prueft die AuditLog-Schema-Version nicht.");
assert.match(source, /prisma\.warehouse\.findFirst\([\s\S]*isDemoData/, "Health-Endpoint prueft die Warehouse-Schema-Version nicht.");
assert.match(source, /status: 503/, "Health-Endpoint muss Schemafehler als 503 melden.");

console.log("Health schema-drift smoke checks passed.");
