import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const script = await readFile("scripts/verify-backup.sh", "utf8");
assert.match(script, /set -Eeuo pipefail/);
assert.match(script, /RESTIC_SNAPSHOT_ID/);
assert.match(script, /restic check/);
assert.match(script, /restore-production\.sh/);
assert.match(script, /ALLOW_DESTRUCTIVE_RESTORE=false/);

const restore = await readFile("scripts/restore-production.sh", "utf8");
assert.match(restore, /manifest\.sha256/);
assert.match(restore, /sha256sum -c/);

const backup = await readFile("scripts/backup-production.sh", "utf8");
assert.match(backup, /restic check/);
assert.ok(existsSync("BACKUP_RESTORE_RUNBOOK.md"));
assert.match(readFileSync("BACKUP_RESTORE_RUNBOOK.md", "utf8"), /Verify-only.*Evidenz|Evidenz.*Verify-only/i);

console.log("Backup verification smoke checks passed.");
