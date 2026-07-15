import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const worker = readFileSync("scripts/process-notifications.sh", "utf8");
const installer = readFileSync("scripts/install-notification-worker-systemd.sh", "utf8");
const service = readFileSync("deploy/flyero-notification-worker.service", "utf8");
const timer = readFileSync("deploy/flyero-notification-worker.timer", "utf8");
const preflight = readFileSync("scripts/production-preflight.mjs", "utf8");
const envExample = readFileSync(".env.production.example", "utf8");
const deployment = readFileSync("DEPLOYMENT_HETZNER.md", "utf8");

assert.ok(existsSync("scripts/process-notifications.sh"), "Notification-Worker-Skript fehlt.");
assert.ok(existsSync("scripts/install-notification-worker-systemd.sh"), "Notification-Worker-Installer fehlt.");
assert.match(worker, /INTERNAL_API_TOKEN/, "Worker muss den internen Token verwenden.");
assert.match(worker, /x-internal-token/, "Worker muss den Token als internen Header senden.");
assert.match(worker, /api\/internal\/notifications\/process/, "Worker muss den bestehenden Queue-Endpoint verwenden.");
assert.match(worker, /https:\/\//, "Worker darf nicht unverschluesselt auf den Produktions-Endpoint zugreifen.");
assert.match(service, /User=flyero/, "Worker darf nicht als root laufen.");
assert.match(service, /flock/, "Worker muss parallele Ausfuehrungen verhindern.");
assert.match(timer, /OnUnitActiveSec=15s/, "Worker-Timer muss neue Betriebs-E-Mails zeitnah verarbeiten.");
assert.match(installer, /flyero-notification-worker\.timer/, "Installer muss den Notification-Timer aktivieren.");
assert.match(preflight, /INTERNAL_API_TOKEN/, "Produktions-Preflight muss den Worker-Token erzwingen.");
assert.match(envExample, /^INTERNAL_API_TOKEN=/m, "ENV-Vorlage muss den Worker-Token dokumentieren.");
assert.match(deployment, /install-notification-worker-systemd\.sh/, "Hetzner-Anleitung muss die Worker-Installation dokumentieren.");

console.log("Notification production worker smoke checks passed.");
