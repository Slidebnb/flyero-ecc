import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const workflowPath = ".github/workflows/deploy-production.yml";
assert.ok(existsSync(workflowPath), "Der automatische Produktions-Deploy muss als GitHub-Workflow versioniert sein.");

const workflow = readFileSync(workflowPath, "utf8");

assert.match(workflow, /workflow_run:/, "Der Deploy muss an den erfolgreichen CI-Lauf gekoppelt sein.");
assert.match(workflow, /workflows:\s*\[\"CI\"\]/, "Der Deploy darf nicht vor dem CI-Workflow starten.");
assert.match(workflow, /conclusion\s*==\s*'success'/, "Nur erfolgreiche CI-Laeufe duerfen deployen.");
assert.match(workflow, /FLYERO_DEPLOY_HOST/, "Der Serverhost muss ueber ein GitHub-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_USER/, "Der Deploy-Benutzer muss ueber ein GitHub-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_SSH_KEY/, "Der private Deploy-Schluessel muss ueber ein GitHub-Secret kommen.");
assert.match(workflow, /FLYERO_DEPLOY_KNOWN_HOSTS/, "Der SSH-Hostschluessel muss fest hinterlegt werden.");
assert.match(workflow, /StrictHostKeyChecking=yes/, "SSH darf die Serveridentitaet nicht blind akzeptieren.");
assert.doesNotMatch(workflow, /StrictHostKeyChecking=no/, "Der Deploy darf die SSH-Hostpruefung nicht abschalten.");
assert.match(workflow, /git pull --ff-only origin main/, "Der Server darf nur fast-forward auf main aktualisiert werden.");
assert.match(workflow, /deployed_sha="\$\(git rev-parse HEAD\)"/, "Der laufende Arbeitsstand muss nach dem Pull dem getesteten Commit entsprechen.");
assert.match(workflow, /\[ "\$deployed_sha" != "\$EXPECTED_SHA" \]/, "Der Deploy darf bei einem abweichenden Arbeitsstand nicht fortfahren.");
assert.match(workflow, /compose=\(docker compose --env-file \/opt\/flyero\/\.env\.production -f \/opt\/flyero\/docker-compose\.production\.yml\)/, "Alle Compose-Befehle muessen mit der Produktions-ENV laufen.");
assert.match(workflow, /\"\$\{compose\[@\]\}\" build --build-arg \"DEPLOY_SHA=\$EXPECTED_SHA\" app/, "Das Produktionsimage muss mit dem getesteten Release-SHA gebaut werden.");
assert.match(workflow, /npx prisma migrate deploy/, "Ausstehende Migrationen muessen kontrolliert angewendet werden.");
assert.match(workflow, /production-preflight\.mjs/, "Der Produktions-Preflight muss vor der Freigabe laufen.");
assert.match(workflow, /api\/health/, "Der Deploy muss den laufenden Healthcheck pruefen.");

console.log("Production deploy workflow smoke checks passed.");
