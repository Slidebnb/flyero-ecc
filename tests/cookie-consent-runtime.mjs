import assert from "node:assert/strict";
import {
  createConsentPreferences,
  hasStatisticsConsent,
  readConsentCookie,
  serializeConsent,
} from "../src/lib/cookieConsent.ts";

const denied = createConsentPreferences({ statistics: false, marketing: false });
const accepted = createConsentPreferences({ statistics: true, marketing: false });

assert.deepEqual(readConsentCookie(encodeURIComponent(serializeConsent(denied))), denied);
assert.deepEqual(readConsentCookie(encodeURIComponent(serializeConsent(accepted))), accepted);
assert.equal(hasStatisticsConsent(denied), false);
assert.equal(hasStatisticsConsent(accepted), true);
assert.equal(readConsentCookie("%7B%22v%22%3A999%7D"), null);
assert.equal(readConsentCookie("not-json"), null);

console.log("Cookie consent runtime passed");
