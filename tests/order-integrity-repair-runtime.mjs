import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

function run(script) {
  const result = spawnSync(process.execPath, ["-r", "dotenv/config", script], { encoding: "utf8", env: process.env });
  assert.equal(result.status, 0, `${script} fehlgeschlagen: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const audit = run("scripts/audit-order-integrity.mjs");
assert.equal(audit.readOnly, true, "Integritätsaudit muss schreibgeschützt laufen.");
const repair = run("scripts/repair-order-integrity.mjs");
assert.equal(repair.mode, "dry-run", "Reparaturprüfung muss standardmäßig Dry-Run sein.");
assert.equal(repair.writesPerformed, false, "Dry-Run darf keine Schreibvorgänge ausführen.");
console.log(`Order integrity audit runtime passed: scanned=${audit.scanned}, dryRunCandidates=${repair.candidates.length}`);
