import assert from "node:assert/strict";
import fs from "node:fs";
import { scanConfiguration, scanStatusForConfiguration, requiresCleanScan } from "../src/lib/fileScanning.ts";

assert.deepEqual(scanStatusForConfiguration({ mode: "required", scannerConfigured: false }), { status: "ERROR", provider: "none" });
assert.deepEqual(scanStatusForConfiguration({ mode: "optional", scannerConfigured: false }), { status: "NOT_CONFIGURED", provider: "none" });
assert.deepEqual(scanStatusForConfiguration({ mode: "disabled", scannerConfigured: false }), { status: "NOT_CONFIGURED", provider: "disabled" });
assert.equal(requiresCleanScan({ mode: "required", status: "NOT_CONFIGURED" }), true);
assert.equal(requiresCleanScan({ mode: "optional", status: "NOT_CONFIGURED" }), false);
assert.equal(scanConfiguration({ mode: "required", clamscanPath: "C:/clamdscan.exe" }).provider, "clamav");

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
assert.match(schema, /enum FileScanStatus\s*\{/);
assert.match(schema, /scanStatus\s+FileScanStatus/);
assert.match(fs.readFileSync("src/lib/documentStorage.ts", "utf8"), /scanFileBuffer/);
assert.match(fs.readFileSync("src/lib/documents.ts", "utf8"), /rescanDocument/);
assert.match(fs.readFileSync("src/app/api/admin/documents/[id]/scan/route.ts", "utf8"), /DOCUMENT_SCAN/);
assert.match(fs.readFileSync("src/lib/tours.ts", "utf8"), /kind: quarantined \? "quarantine" : "proofs"/);
assert.match(fs.readFileSync("src/app/api/admin/report-photos/[id]/scan/route.ts", "utf8"), /photo\.scan_completed/);

console.log("File scan smoke checks passed.");
