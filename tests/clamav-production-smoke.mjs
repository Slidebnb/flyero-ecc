import assert from "node:assert/strict";
import fs from "node:fs";

const dockerfile = fs.readFileSync("Dockerfile", "utf8");
const compose = fs.readFileSync("docker-compose.production.yml", "utf8");
const startup = fs.readFileSync("scripts/start-production.sh", "utf8");

assert.match(dockerfile, /clamav-freshclam/, "Das Produktionsimage muss FreshClam fuer Signaturupdates enthalten.");
assert.match(dockerfile, /start-production\.sh/, "Der Produktionsstart muss die ClamAV-Initialisierung ausfuehren.");
assert.match(compose, /clamav_data:\s*\/var\/lib\/clamav/, "Die ClamAV-Signaturen muessen ueber Container-Neustarts erhalten bleiben.");
assert.match(startup, /freshclam/, "Der Produktionsstart muss fehlende ClamAV-Signaturen aktualisieren.");
assert.match(startup, /main\.cvd|main\.cld|\.cvd|\.cld/, "Der Produktionsstart muss vorhandene Signaturdateien erkennen.");
assert.match(startup, /npx prisma migrate deploy/, "Der bestehende Produktionsstart mit Migration und Next.js muss erhalten bleiben.");

console.log("ClamAV production smoke checks passed.");
