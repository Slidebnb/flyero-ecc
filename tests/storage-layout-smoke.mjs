import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [compose, generatedAssets, backup, restore, packageJson] = await Promise.all([
  readFile("docker-compose.production.yml", "utf8"),
  readFile("src/lib/generatedAssets.ts", "utf8"),
  readFile("scripts/backup-production.sh", "utf8"),
  readFile("scripts/restore-production.sh", "utf8"),
  readFile("package.json", "utf8").then(JSON.parse),
]);

assert.match(generatedAssets, /path\.join\(\/\*turbopackIgnore: true\*\/ process\.cwd\(\), "storage", "generated"\)/,
  "Generated-Assets muessen standardmaessig im persistenten Storage liegen.");
assert.match(compose, /app_generated:\/app\/storage\/generated/,
  "Das Produktionsvolume fuer Generated-Assets muss am tatsaechlichen Anwendungspfad gemountet werden.");
assert.doesNotMatch(compose, /app_generated:\/app\/public\/generated/,
  "Der alte, von der Anwendung nicht verwendete Public-Generated-Pfad darf nicht gemountet werden.");
assert.match(backup, /tar -C \/app\/storage\/generated -cf - \./,
  "Backups muessen den tatsaechlichen Generated-Asset-Pfad sichern.");
assert.match(restore, /tar -C \/app\/storage\/generated -xf -/,
  "Restores muessen in den tatsaechlichen Generated-Asset-Pfad schreiben.");
assert.equal(packageJson.scripts["test:storage-layout"], "node tests/storage-layout-smoke.mjs",
  "Der Storage-Layout-Regressionstest muss als npm-Script erreichbar sein.");

console.log("Storage layout smoke ok");
