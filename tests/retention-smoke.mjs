import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [script, policy, packageJson] = await Promise.all([
  readFile("scripts/retention.mjs", "utf8"),
  readFile("RETENTION_POLICY.md", "utf8"),
  readFile("package.json", "utf8"),
]);

assert.match(script, /RETENTION_APPLY/);
assert.match(script, /mode: apply \? "apply" : "dry-run"/);
assert.match(script, /GpsPoint.*PhotoProof.*Document.*AuditLog.*Invoice/s);
assert.match(policy, /standardmäßig nur als Dry-Run/);
assert.match(policy, /RETENTION_APPLY=true/);
assert.match(packageJson, /retention:report/);
assert.match(packageJson, /retention:purge/);

const result = spawnSync(process.execPath, ["-r", "dotenv/config", "scripts/retention.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, RETENTION_APPLY: "false" },
  encoding: "utf8",
});
assert.equal(result.status, 0, `Retention-Dry-Run fehlgeschlagen:\n${result.stdout}\n${result.stderr}`);
const summary = JSON.parse(result.stdout);
assert.equal(summary.mode, "dry-run", "Retention darf standardmäßig keinen Purge ausführen.");
assert.deepEqual(summary.deleted, { verificationTokens: 0, sessions: 0, rateLimitBuckets: 0, publicRateLimitBuckets: 0 });

console.log("Retention Smoke-Test erfolgreich abgeschlossen.");
