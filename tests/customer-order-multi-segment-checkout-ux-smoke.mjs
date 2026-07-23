import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const material = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const validators = readFileSync("src/lib/validators.ts", "utf8");
const request = readFileSync("src/lib/request.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

assert.match(
  wizard,
  /const retainedSegments = options\?\.forceReplace \? \[\] : areaSegmentsRef\.current\.filter\(\(segment\) => segment\.id !== activeSegmentId && segment\.points\.length >= 3\);/,
  "Eine neue PLZ darf bereits bestaetigte Teilgebiete nicht loeschen.",
);
assert.match(
  wizard,
  /areaSegmentsRef\.current = nextSegments;\s*setAreaSegments\(nextSegments\);/,
  "Die Ref fuer Teilgebiete muss beim Hinzufuegen synchron aktualisiert werden.",
);
assert.match(
  wizard,
  /!isGermanPostalCode\(planningPostalCode\) \|\| planningCity\.trim\(\)\.length < 2\)\) \{[\s\S]{0,240}setFinishStatus\("Bitte [^"]*Verteilgebiet aus\."\);/,
  "Checkout muss fehlende Gebietsgrunddaten vor dem Absenden freundlich erklaeren.",
);
assert.match(validators, /postalCode: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{5\}\$\/, "Bitte gib eine gültige fünfstellige PLZ ein\."\)/);
assert.doesNotMatch(validators, /billingPostalCode: z\.string\(\)\.min\(3\)/, "Rechnungs-PLZ darf beim Checkout keine rohe Zod-min-3-Meldung mehr erzeugen.");
assert.match(validators, /billingPostalCode: z\.string\(\)\.trim\(\)\.regex\(\/\^\\d\{5\}\$\//, "Rechnungs-PLZ muss als fuenfstellige PLZ validiert werden.");
assert.doesNotMatch(validators, /postalCode: z\.string\(\)\.min\(3\)/, "Adress- und Verteiler-PLZ duerfen keine rohe Zod-min-3-Meldung mehr erzeugen.");
assert.match(request, /ZodError/, "Zod-Fehler muessen zentral in eine kundenfreundliche Meldung umgewandelt werden.");
assert.match(request, /Too small|Invalid input|Expected/, "Technische Zod-Standardmeldungen duerfen nicht zum Kunden gelangen.");
assert.match(validators, /city: z\.string\(\)\.trim\(\)\.min\(2, "Bitte gib einen Ort an\."\)/);
const quantityIntroIndex = material.indexOf('className="flyerQuantityIntro"');
const serviceChoiceIndex = material.indexOf('className="serviceChoiceList"');
assert.ok(quantityIntroIndex >= 0 && quantityIntroIndex < serviceChoiceIndex, "Die Flyerzahl muss im Ablauf vor den weiteren Materialdetails stehen.");
assert.equal(packageJson.scripts["test:customer-order-multi-segment-checkout-ux"], "node tests/customer-order-multi-segment-checkout-ux-smoke.mjs");

console.log("Multi-Segment-Checkout-UX-Regression: OK");
