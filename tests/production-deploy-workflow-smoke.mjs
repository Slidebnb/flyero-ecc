import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowPath = ".github/workflows/deploy-production.yml";
const scriptPath = "scripts/deploy-production.ps1";

assert.equal(existsSync(workflowPath), false, "Der Produktions-Deploy darf nicht mehr automatisch durch GitHub Actions laufen.");
assert.ok(existsSync(scriptPath), "Der manuelle PowerShell-Deploy muss versioniert sein.");

const script = readFileSync(scriptPath, "utf8");

assert.match(script, /StrictHostKeyChecking=yes/, "SSH muss die Serveridentitaet fest pruefen.");
assert.doesNotMatch(script, /StrictHostKeyChecking=no/, "SSH darf die Hostpruefung nicht abschalten.");
assert.match(script, /git pull --ff-only origin main/, "Der Server darf nur fast-forward auf main aktualisiert werden.");
assert.match(script, /docker compose --env-file \/opt\/flyero\/\.env\.production -f \/opt\/flyero\/docker-compose\.production\.yml/, "Alle Compose-Befehle muessen mit der Produktions-ENV laufen.");
assert.match(script, /build --build-arg \"DEPLOY_SHA=/, "Das Produktionsimage muss mit einem Release-SHA gebaut werden.");
assert.match(script, /npx prisma migrate deploy/, "Ausstehende Migrationen muessen kontrolliert angewendet werden.");
assert.match(script, /production-preflight\.mjs/, "Der Produktions-Preflight muss vor der Freigabe laufen.");
assert.match(script, /api\/health/, "Der Deploy muss den laufenden Healthcheck pruefen.");

console.log("Manual PowerShell deploy smoke checks passed.");
