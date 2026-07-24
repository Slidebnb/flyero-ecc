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
  /FLYERO_DISTRIBUTOR_CACHE = "flyero-distributor-shell-v3"/,
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
  /getRegistrations\(\)[\s\S]*unregister/,
  "Auf Kunden- und Adminseiten muessen alte Distributor-Service-Worker entfernt werden.",
);
assert.match(
  registration,
  /pathname[\s\S]*(distributor|offline)/,
  "Der Distributor-Service-Worker darf nur auf seinen eigenen Seiten registriert werden.",
);

console.log("Service-Worker-Cache-Regeln: OK");
