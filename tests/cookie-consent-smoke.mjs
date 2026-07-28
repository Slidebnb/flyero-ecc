import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const consent = read("src/lib/cookieConsent.ts");
const component = read("src/app/CookieConsent.tsx");
const settingsLink = read("src/app/CookieSettingsLink.tsx");
const layout = read("src/app/layout.tsx");
const marketing = read("src/app/components/marketing/index.tsx");
const styles = read("src/app/globals.css");

assert.match(consent, /flyero_cookie_consent_v1/);
assert.match(consent, /statistics/);
assert.match(consent, /marketing/);
assert.match(consent, /Max-Age/);
assert.match(consent, /SameSite=Lax/);
assert.match(consent, /readConsentCookie/);
assert.match(consent, /readConsentFromCookieString/);
assert.match(consent, /hasStatisticsConsent/);

assert.match(component, /data-testid="cookie-consent-banner"/);
assert.match(component, /data-testid="cookie-consent-reject"/);
assert.match(component, /data-testid="cookie-consent-save"/);
assert.match(component, /data-testid="cookie-consent-accept"/);
assert.match(component, /flyero:open-cookie-settings/);
assert.match(component, /Deine Cookie-Einstellungen/);
assert.doesNotMatch(component, /googletagmanager|connect.facebook.net|analytics\.google\.com/);

assert.match(settingsLink, /Cookie-Einstellungen/);
assert.match(settingsLink, /flyero:open-cookie-settings/);
assert.match(layout, /<CookieConsent\s*\/>/);
assert.match(marketing, /CookieSettingsLink/);
assert.match(styles, /\.cookieConsent/);

for (const relativePath of [
  "src/app/LeadForm.tsx",
  "src/app/PublicPlannerSearch.tsx",
  "src/app/login/LoginForm.tsx",
  "src/app/register/customer/CustomerRegisterForm.tsx",
  "src/app/customer/orders/new/SmartOrderWizard.tsx",
]) {
  const source = read(relativePath);
  assert.match(source, /hasStatisticsConsent/,
    `${relativePath} muss optionale Statistik an die Zustimmung koppeln.`);
}

console.log("Cookie consent smoke passed");
