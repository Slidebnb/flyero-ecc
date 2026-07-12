import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

const [ci, codeql, dependabot, packageJson] = await Promise.all([
  read(".github/workflows/ci.yml"),
  read(".github/workflows/codeql.yml"),
  read(".github/dependabot.yml"),
  read("package.json").then(JSON.parse),
]);

assert.match(ci, /pull_request:\s*\n\s*branches:\s*\[main\]/, "CI muss Pull Requests auf main pruefen.");
assert.match(ci, /push:\s*\n\s*branches:\s*\[main\]/, "CI muss Pushes auf main pruefen.");
assert.match(ci, /permissions:\s*\n\s*contents:\s*read/, "CI muss mit minimalen Leserechten laufen.");
assert.match(ci, /actions\/checkout@v5/, "CI muss die aktuelle Checkout-Major-Version verwenden.");
assert.match(ci, /actions\/setup-node@v5/, "CI muss die aktuelle Setup-Node-Major-Version verwenden.");
assert.match(ci, /node-version:\s*["']22["']/, "CI muss die produktive Node-22-Linie verwenden.");
assert.match(ci, /npm install -g npm@11\.6\.2/, "CI muss dieselbe npm-Version wie das Produktions-Image verwenden.");
assert.match(ci, /npm ci/, "CI muss reproduzierbar aus package-lock installieren.");
assert.match(ci, /npx prisma validate/, "CI muss das Prisma-Schema validieren.");
assert.match(ci, /npm run prisma:generate/, "CI muss den Prisma Client erzeugen.");
assert.match(ci, /npm run lint/, "CI muss ESLint ausfuehren.");
assert.match(ci, /npm run build/, "CI muss den Produktions-Build ausfuehren.");
assert.match(ci, /npm audit --omit=dev --audit-level=high/, "CI muss hohe produktive Advisories blockieren.");
assert.match(ci, /postgres:\s*\n\s*image:\s*postgres:16-alpine/, "Kritische Smokes brauchen isoliertes PostgreSQL 16.");
assert.match(ci, /npx prisma migrate deploy/, "CI muss Migrationen gegen eine frische Datenbank pruefen.");
assert.match(ci, /npm run prisma:seed/, "CI-Smokes muessen eine reproduzierbare Datenbasis erhalten.");
assert.match(ci, /CUSTOMER_ORDER_AREA_BASE_URL:\s*http:\/\/127\.0\.0\.1:3000/, "Gebietstest muss den gemeinsamen CI-Server verwenden.");
assert.match(ci, /CUSTOMER_ORDER_CHECKOUT_BASE_URL:\s*http:\/\/127\.0\.0\.1:3000/, "Checkout-Test muss den gemeinsamen CI-Server verwenden.");
assert.match(ci, /BETA_BASE_URL:\s*http:\/\/127\.0\.0\.1:3000/, "Beta-Smokes muessen den gemeinsamen CI-Server verwenden.");
assert.match(ci, /name:\s*Start shared test server/, "CI muss genau einen gemeinsamen Next-Testserver starten.");
assert.match(ci, /flyero-dev\.log/, "CI muss die Testserver-Ausgabe fuer Fehlerdiagnosen sichern.");
assert.match(ci, /npm run test:security-headers/, "CI muss die Security-Header-Konfiguration pruefen.");
for (const script of [
  "test:auth-ux",
  "test:auth-session",
  "test:tenant-foundation",
  "test:auth-abuse",
  "test:public-abuse",
  "test:payment-reconciliation",
  "test:password-reset",
  "test:password-reset-live",
  "test:permissions",
  "test:retention",
  "test:private-storage",
  "test:backup-scheduler",
  "test:module25",
  "test:customer-order-area",
  "test:customer-order-checkout",
  "test:distribution-reports",
  "test:external-distribution-report",
]) {
  assert.ok(ci.includes(`npm run ${script}`), `CI muss ${script} ausfuehren.`);
}

assert.match(codeql, /security-events:\s*write/, "CodeQL braucht ausschliesslich den Security-Upload zusaetzlich.");
assert.match(codeql, /github\/codeql-action\/init@v4/, "CodeQL muss die aktuelle Major-Version verwenden.");
assert.match(codeql, /github\/codeql-action\/analyze@v4/, "CodeQL muss Ergebnisse analysieren.");
assert.match(codeql, /javascript-typescript/, "CodeQL muss TypeScript und JavaScript abdecken.");
assert.match(codeql, /schedule:/, "CodeQL muss auch planmaessig laufen.");

assert.match(dependabot, /package-ecosystem:\s*["']npm["']/, "Dependabot muss npm-Abhaengigkeiten beobachten.");
assert.match(dependabot, /package-ecosystem:\s*["']github-actions["']/, "Dependabot muss Actions beobachten.");
assert.equal(packageJson.scripts["test:ci-config"], "node tests/ci-config-smoke.mjs", "package.json braucht test:ci-config.");
assert.equal(packageJson.packageManager, "npm@11.6.2", "package.json muss die Lockfile-npm-Version festschreiben.");

console.log("ci-config smoke ok");
