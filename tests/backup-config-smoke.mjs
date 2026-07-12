import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

async function read(path) {
  assert.ok(existsSync(path), `${path} fehlt.`);
  return readFile(path, "utf8");
}

const [backup, restore, runbook, envExample, packageJson] = await Promise.all([
  read("scripts/backup-production.sh"),
  read("scripts/restore-production.sh"),
  read("BACKUP_RESTORE_RUNBOOK.md"),
  read(".env.production.example"),
  read("package.json").then(JSON.parse),
]);

assert.match(backup, /set -Eeuo pipefail/, "Backup muss bei Fehlern sofort abbrechen.");
assert.match(backup, /pg_dump/, "Backup muss PostgreSQL sichern.");
assert.match(backup, /--format=custom/, "PostgreSQL-Dump muss im wiederherstellbaren Custom-Format erfolgen.");
assert.match(backup, /restic backup/, "Backup muss ein verschluesseltes Restic-Repository verwenden.");
assert.match(backup, /restic forget/, "Backup muss eine dokumentierte Retention anwenden.");
assert.match(backup, /sha256sum/, "Backup muss Integritaetschecksummen schreiben.");
assert.match(backup, /trap .*cleanup|trap cleanup/, "Backup muss temporaere Dateien sicher bereinigen.");
assert.match(backup, /app\/storage\/generated/, "Backup muss den tatsaechlichen Generated-Storage sichern.");
assert.match(backup, /export-private-s3\.mjs/, "Backup muss den S3-Provider beruecksichtigen.");

assert.match(restore, /set -Eeuo pipefail/, "Restore muss bei Fehlern sofort abbrechen.");
assert.match(restore, /ALLOW_DESTRUCTIVE_RESTORE/, "Restore muss eine explizite Destructive-Gate verlangen.");
assert.match(restore, /restic restore/, "Restore muss Snapshots aus Restic wiederherstellen.");
assert.match(restore, /pg_restore/, "Restore muss PostgreSQL-Custom-Dumps wiederherstellen koennen.");
assert.match(restore, /sha256sum -c/, "Restore muss das Manifest vor dem Einspielen pruefen.");
assert.match(restore, /RESTIC_SNAPSHOT_ID/, "Restore muss einen expliziten Snapshot akzeptieren.");
assert.match(restore, /app\/storage\/generated/, "Restore muss in den tatsaechlichen Generated-Storage schreiben.");
assert.match(restore, /import-private-s3\.mjs/, "Restore muss den S3-Provider beruecksichtigen.");

assert.match(runbook, /RPO/i, "Runbook muss RPO dokumentieren.");
assert.match(runbook, /RTO/i, "Runbook muss RTO dokumentieren.");
assert.match(runbook, /Hetzner Storage Box|S3|SFTP/i, "Runbook muss ein externes Backupziel beschreiben.");
assert.match(runbook, /Restore.*Staging|Staging.*Restore/i, "Runbook muss einen nicht-produktiven Restore-Test beschreiben.");
assert.match(runbook, /keine.*Secrets|Secrets.*nicht/i, "Runbook muss Secret-Schutz dokumentieren.");
for (const variable of [
  "BACKUP_RESTIC_REPOSITORY",
  "BACKUP_RESTIC_PASSWORD_FILE",
  "BACKUP_RETENTION_DAILY",
  "BACKUP_RETENTION_WEEKLY",
  "BACKUP_RETENTION_MONTHLY",
]) {
  assert.ok(envExample.includes(variable), `.env.production.example braucht ${variable}.`);
}
assert.equal(packageJson.scripts["backup:config"], "node tests/backup-config-smoke.mjs", "package.json braucht backup:config.");

console.log("backup-config smoke ok");
