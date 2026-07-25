import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const serviceWorker = readFileSync("public/sw.js", "utf8");

assert.match(
  serviceWorker,
  /function isNextStaticRequest\(request\)/,
  "Der Service Worker muss Next-Assets als eigene Request-Klasse erkennen.",
);
assert.match(
  serviceWorker,
  /isNextStaticRequest\(request\)[\s\S]*?event\.respondWith\(fetch\(request\)\)/,
  "Next-Assets duerfen nicht aus dem veralteten Offline-Cache kommen.",
);
assert.match(
  serviceWorker,
  /FLYERO_DISTRIBUTOR_CACHE = "flyero-distributor-shell-v4"/,
  "Der Cache muss nach der Korrektur versioniert werden.",
);
assert.match(
  serviceWorker,
  /request.url.*origin.*self.location.origin|url.origin.*self.location.origin[\s\S]*return;/,
  "Cross-Origin-Ressourcen wie Google Fonts und Maps duerfen nicht vom Service Worker abgefangen werden.",
);
const registration = readFileSync("src/app/ServiceWorkerRegister.tsx", "utf8");
assert.match(
  registration,
  /flyero-distributor-sw-cleaned-v4[\s\S]*localStorage[\s\S]*getRegistrations\(\)[\s\S]*unregister/,
  "Alte globale Service-Worker muessen einmalig bereinigt werden, nicht bei jedem Seitenwechsel.",
);
assert.match(
  registration,
  /register\("\/sw\.js",\s*\{\s*scope:\s*"\/distributor\/"\s*\}\)/,
  "Der Distributor-Service-Worker darf nur den Verteilerbereich kontrollieren.",
);
assert.match(
  serviceWorker,
  /url\.pathname\.startsWith\("\/distributor\/"\)/,
  "Verteilerseiten duerfen nicht als persoenliche HTML-Daten gecacht werden.",
);

console.log("Service-Worker-Cache-Regeln: OK");
