import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowPath = ".github/workflows/deploy-production.yml";
const scriptPath = "scripts/deploy-production.ps1";

assert.equal(existsSync(workflowPath), true, "Der Produktions-Deploy muss als kontrollierter GitHub-Workflow versioniert sein.");
assert.ok(existsSync(scriptPath), "Der manuelle PowerShell-Deploy muss versioniert sein.");

const workflow = readFileSync(workflowPath, "utf8");
const script = readFileSync(scriptPath, "utf8");

assert.match(workflow, /workflow_run:/, "Der Deploy muss auf den erfolgreichen CI-Lauf warten.");
assert.match(workflow, /conclusion\s*==\s*'success'/, "Der Deploy darf nur nach erfolgreichem CI-Lauf starten.");
assert.match(workflow, /FLYERO_DEPLOY_HOST/, "Der Host muss aus einem geschuetzten Repository-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_USER/, "Der Deploy-Benutzer muss aus einem geschuetzten Repository-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_SSH_KEY/, "Der SSH-Schluessel muss aus einem geschuetzten Repository-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_KNOWN_HOSTS/, "Die bekannten Hostschluessel muessen aus einem geschuetzten Repository-Secret kommen.");
assert.match(workflow, /-ExpectedSha/, "Der Workflow muss den getesteten Commit an den Deploy uebergeben.");

assert.match(script, /StrictHostKeyChecking=yes/, "SSH muss die Serveridentitaet fest pruefen.");
assert.doesNotMatch(script, /StrictHostKeyChecking=no/, "SSH darf die Hostpruefung nicht abschalten.");
assert.match(script, /git pull --ff-only origin main/, "Der Server darf nur fast-forward auf main aktualisiert werden.");
assert.match(script, /docker compose --env-file \/opt\/flyero\/\.env\.production -f \/opt\/flyero\/docker-compose\.production\.yml/, "Alle Compose-Befehle muessen mit der Produktions-ENV laufen.");
assert.match(script, /build --build-arg \"DEPLOY_SHA=/, "Das Produktionsimage muss mit einem Release-SHA gebaut werden.");
assert.match(script, /git rev-parse --verify .*\^\{commit\}/, "Kurze und vollstaendige ExpectedSha muessen auf denselben Commit aufgeloest werden.");
assert.match(script, /npx prisma migrate deploy/, "Ausstehende Migrationen muessen kontrolliert angewendet werden.");
assert.match(script, /run --rm --no-deps app node scripts\/production-preflight\.mjs < \/dev\/null/, "Der Preflight darf den ueber SSH uebergebenen Bash-Input nicht konsumieren.");
assert.match(script, /run --rm --no-deps app npx prisma migrate deploy < \/dev\/null/, "Die Migration darf den ueber SSH uebergebenen Bash-Input nicht konsumieren.");
assert.match(script, /up -d --force-recreate --no-deps app caddy/, "Der Deploy muss den Reverse-Proxy mit dem aktuellen Caddyfile recreaten.");
assert.match(script, /exec -T app node -e .*< \/dev\/null/, "Der App-Healthcheck darf den ueber SSH uebergebenen Bash-Input nicht konsumieren.");
assert.match(script, /built_image=.*docker image inspect flyero-app/, "Der Deploy muss den Digest des gebauten Images festhalten.");
assert.match(script, /app_container=.*compose\[@\].*ps -q app/, "Der Deploy muss den laufenden App-Container aus Compose ermitteln.");
assert.match(script, /running_image=.*docker inspect .*\$app_container/, "Der Deploy muss den Digest des laufenden App-Containers auslesen.");
assert.match(script, /built_image.*running_image|running_image.*built_image/, "Der Deploy muss gebauten und laufenden Image-Digest vergleichen.");
assert.match(script, /\$remoteScript\s*=\s*\$remoteScript\.Replace\([\s\S]*`r`n[\s\S]*`n/, "Das an Bash uebergebene Remote-Skript muss auf Unix-Zeilenenden normalisiert werden.");
assert.match(script, /production-preflight\.mjs/, "Der Produktions-Preflight muss vor der Freigabe laufen.");
assert.match(script, /api\/health/, "Der Deploy muss den laufenden Healthcheck pruefen.");

console.log("Manual PowerShell deploy smoke checks passed.");
