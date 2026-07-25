import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pricingPage = readFileSync("src/app/preise/page.tsx", "utf8");
const smartMaps = readFileSync("src/lib/smartMaps.ts", "utf8");
const serviceWorkerRegister = readFileSync("src/app/ServiceWorkerRegister.tsx", "utf8");
const serviceWorker = readFileSync("public/sw.js", "utf8");
const styles = readFileSync("src/app/globals.css", "utf8");

assert.match(
  pricingPage,
  /const \[pricingResult, calculatedExamples\] = await Promise\.all\(/,
  "Die Preis-Seite muss Einstellungen und Beispielpreise parallel laden.",
);
assert.doesNotMatch(
  pricingPage,
  /pricing = await getPricingSettings\(\);\s+examplePrices = await Promise\.all/,
  "Die Preis-Seite darf die Beispielpreise nicht erst nach den Einstellungen laden.",
);

assert.doesNotMatch(
  smartMaps,
  /const initialPrice = await calculateOrderPrice\(/,
  "Die Gebietsquote darf keine verworfene Vorab-Preisberechnung ausführen.",
);
assert.doesNotMatch(
  smartMaps,
  /legacyStepState/,
  "Der Order-Wizard darf keinen verworfenen Legacy-Schrittstatus mehr berechnen.",
);
assert.doesNotMatch(
  styles,
  /\.oldFlyerStack\b/,
  "Nicht verwendete alte Flyer-Stack-Dekoration darf nicht im globalen Stylesheet bleiben.",
);

assert.match(
  serviceWorkerRegister,
  /register\("\/sw\.js",\s*\{\s*scope:\s*"\/distributor\/"\s*\}\)/,
  "Der Service Worker darf nur noch den Verteilerbereich kontrollieren.",
);
assert.match(
  serviceWorkerRegister,
  /flyero-distributor-sw-cleaned-v4[\s\S]*localStorage|localStorage[\s\S]*flyero-distributor-sw-cleaned-v4/,
  "Die Bereinigung alter Service-Worker muss einmalig statt bei jedem Seitenwechsel erfolgen.",
);
assert.doesNotMatch(
  serviceWorker,
  /const SHELL_URLS = \["\/", "\/login"/,
  "Der Verteiler-Cache darf keine globale Public-Shell mehr vorladen.",
);

console.log("Performance-Pfade: OK");
