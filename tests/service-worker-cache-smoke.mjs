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
  /FLYERO_DISTRIBUTOR_CACHE = "flyero-distributor-shell-v2"/,
  "Der Cache muss nach der Korrektur versioniert werden.",
);

console.log("Service-Worker-Cache-Regeln: OK");
