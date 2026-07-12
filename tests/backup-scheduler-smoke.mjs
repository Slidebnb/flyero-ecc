import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const files = [
  "deploy/flyero-backup.service",
  "deploy/flyero-backup.timer",
  "deploy/flyero-backup-failure@.service",
  "deploy/flyero-backup.env.example",
  "scripts/install-backup-systemd.sh",
];

for (const file of files) assert.ok(existsSync(file), `${file} fehlt.`);
const [service, timer, failure, env, installer] = await Promise.all(files.map((file) => readFile(file, "utf8")));

assert.match(service, /User=flyero/);
assert.match(service, /WorkingDirectory=\/opt\/flyero/);
assert.match(service, /EnvironmentFile=-\/etc\/flyero\/backup\.env/);
assert.match(service, /flock/);
assert.match(service, /scripts\/backup-production\.sh/);
assert.match(service, /OnFailure=flyero-backup-failure@%n\.service/);
assert.match(timer, /OnCalendar=.*03:15/);
assert.match(timer, /Persistent=true/);
assert.match(timer, /RandomizedDelaySec=/);
assert.match(timer, /flyero-backup\.service/);
assert.match(failure, /logger/);
assert.match(failure, /journalctl|flyero-backup/);
for (const variable of ["BACKUP_RESTIC_REPOSITORY", "BACKUP_RESTIC_PASSWORD_FILE", "BACKUP_READ_DATA_SUBSET", "ENV_FILE", "COMPOSE_FILE"]) {
  assert.ok(env.includes(variable), `Backup-Umgebung braucht ${variable}.`);
}
assert.match(installer, /systemctl daemon-reload/);
assert.match(installer, /systemctl enable --now flyero-backup\.timer/);
assert.match(installer, /chmod 600|install -m 0600/);

console.log("Backup scheduler smoke ok");
