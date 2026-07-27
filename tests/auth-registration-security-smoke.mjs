import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const validators = read("src/lib/validators.ts");
const customerRoute = read("src/app/api/auth/register-customer/route.ts");
const distributorRoute = read("src/app/api/auth/register-distributor/route.ts");
const verifyRoute = read("src/app/api/auth/verify-email/route.ts");
const availableOrdersRoute = read("src/app/api/distributor/available-orders/route.ts");
const distributorPage = read("src/app/register/distributor/page.tsx");

assert.match(schema, /termsAcceptedAt\s+DateTime\?/,
  "Einwilligungszeitpunkt muss dauerhaft am Benutzer gespeichert werden.");
assert.match(schema, /termsVersion\s+String\?/,
  "Die akzeptierte Rechtsversion muss am Benutzer gespeichert werden.");
assert.match(validators, /customerRegisterSchema[\s\S]*acceptsTerms/,
  "Kundenregistrierung muss die Einwilligung validieren.");
assert.match(validators, /birthDate[\s\S]*18 Jahre|birthDate[\s\S]*Vollj[aä]hrig/,
  "Verteilerregistrierung muss die Volljährigkeit serverseitig prüfen.");
assert.match(customerRoute, /termsAcceptedAt/,
  "Kundenregistrierung muss die Einwilligung speichern.");
assert.match(distributorRoute, /encryptSensitiveString[\s\S]*taxNumber|taxNumber[\s\S]*encryptSensitiveString/,
  "Steuer- und Bankdaten dürfen nicht als Klartext gespeichert werden.");
assert.match(verifyRoute, /UserStatus\.DISABLED|UserStatus\.BANNED/,
  "E-Mail-Verifizierung darf gesperrte Konten nicht reaktivieren.");
assert.match(verifyRoute, /reviewStatus[\s\S]*PAUSED[\s\S]*BANNED|PAUSED[\s\S]*BANNED[\s\S]*reviewStatus/,
  "E-Mail-Verifizierung darf pausierte oder gesperrte Verteilerfreigaben nicht zurÃ¼cksetzen.");
assert.match(verifyRoute, /Promise\.allSettled/,
  "Nebenwirkungen nach der E-Mail-Verifizierung dÃ¼rfen eine bereits erfolgreiche Aktivierung nicht als Fehler melden.");
assert.match(availableOrdersRoute, /requireApprovedDistributor/,
  "Nicht freigegebene Verteiler dürfen keine verfügbaren Aufträge sehen.");
assert.match(distributorRoute, /headers\.get\("accept"\)[\s\S]*register\/distributor/,
  "HTML-Fehler der Verteilerregistrierung dürfen nicht als rohe JSON-Seite erscheinen.");
assert.match(distributorPage, /searchParams[\s\S]*error/,
  "Die Verteilerregistrierung muss verständliche Fehler auf der Formularseite anzeigen.");
assert.ok(fs.existsSync("src/lib/secureFields.ts"),
  "Die Verschlüsselung sensibler Verteilerfelder muss zentral implementiert sein.");

console.log("Auth registration security contract passed.");
