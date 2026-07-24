import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const wizard = readFileSync("src/app/customer/orders/new/SmartOrderWizard.tsx", "utf8");
const material = readFileSync("src/app/customer/orders/new/OrderMaterialStep.tsx", "utf8");
const validators = readFileSync("src/lib/validators.ts", "utf8");
const request = readFileSync("src/lib/request.ts", "utf8");
const customerOrdersRoute = readFileSync("src/app/api/customer/orders/route.ts", "utf8");
const customerOrderDetailRoute = readFileSync("src/app/api/customer/orders/[id]/route.ts", "utf8");
const customerProfileRoute = readFileSync("src/app/api/customer/profile/route.ts", "utf8");
const customerProfileCompletionRoute = readFileSync("src/app/api/customer/profile/complete/route.ts", "utf8");
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
assert.match(request, /too small|invalid input|expected string|expected \.\*characters|at least \\d\+ character/i, "Technische Zod-Standardmeldungen duerfen nicht zum Kunden gelangen.");
assert.match(request, /export function validationErrorResponse/, "Kundenrouten muessen dieselbe Validierungsantwort verwenden.");
assert.match(request, /sanitizeErrorMessage/, "Technische Validierungsfehler muessen auch bei generischen Fehlerantworten verborgen werden.");
assert.match(request, /expected \.\*characters\|at least \\d\+ character/i, "Aeltere und neuere Zod-Meldungsvarianten muessen gleichermassen verborgen werden.");
assert.match(wizard, /function customerFacingSubmissionError/, "Der Wizard darf technische API-Fehler nicht direkt im Kundenstatus anzeigen.");
assert.doesNotMatch(wizard, /setFinishStatus\(error instanceof Error \? error\.message/, "Der Wizard darf rohe Fehlertexte nicht direkt anzeigen.");
for (const [name, source] of Object.entries({ customerOrdersRoute, customerOrderDetailRoute, customerProfileRoute, customerProfileCompletionRoute })) {
  assert.doesNotMatch(source, /parsed\.error\.issues\[0\]\?\.message/, `${name} darf keine rohe Zod-Meldung an Kunden senden.`);
  assert.match(source, /validationErrorResponse\(parsed\.error/, `${name} muss die zentrale Validierungsantwort verwenden.`);
}
assert.match(validators, /city: z\.string\(\)\.trim\(\)\.min\(2, "Bitte gib einen Ort an\."\)/);
const quantityIntroIndex = material.indexOf('className="flyerQuantityIntro"');
const serviceChoiceIndex = material.indexOf('className="serviceChoiceList"');
assert.ok(quantityIntroIndex >= 0 && quantityIntroIndex < serviceChoiceIndex, "Die Flyerzahl muss im Ablauf vor den weiteren Materialdetails stehen.");
assert.equal(packageJson.scripts["test:customer-order-multi-segment-checkout-ux"], "node tests/customer-order-multi-segment-checkout-ux-smoke.mjs");

console.log("Multi-Segment-Checkout-UX-Regression: OK");
