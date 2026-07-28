export const COOKIE_CONSENT_NAME = "flyero_cookie_consent_v1";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const COOKIE_CONSENT_VERSION = 1;

export type ConsentPreferences = {
  statistics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function createConsentPreferences(input: { statistics: boolean; marketing?: boolean }): ConsentPreferences {
  return {
    statistics: input.statistics === true,
    marketing: input.marketing === true,
    updatedAt: new Date().toISOString(),
  };
}

export function serializeConsent(preferences: ConsentPreferences): string {
  return JSON.stringify({
    v: COOKIE_CONSENT_VERSION,
    statistics: preferences.statistics,
    marketing: preferences.marketing,
    updatedAt: preferences.updatedAt,
  });
}

export function readConsentCookie(value: string | null | undefined): ConsentPreferences | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      v?: unknown;
      statistics?: unknown;
      marketing?: unknown;
      updatedAt?: unknown;
    };
    if (
      parsed.v !== COOKIE_CONSENT_VERSION
      || typeof parsed.statistics !== "boolean"
      || typeof parsed.marketing !== "boolean"
      || typeof parsed.updatedAt !== "string"
      || !Number.isFinite(Date.parse(parsed.updatedAt))
    ) {
      return null;
    }
    return {
      statistics: parsed.statistics,
      marketing: parsed.marketing,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readConsentFromDocument(): ConsentPreferences | null {
  if (typeof document === "undefined") return null;
  return readConsentFromCookieString(document.cookie);
}

export function readConsentFromCookieString(cookieString: string): ConsentPreferences | null {
  const cookie = cookieString
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_CONSENT_NAME}=`));
  return readConsentCookie(cookie?.slice(COOKIE_CONSENT_NAME.length + 1));
}

export function writeConsentCookie(preferences: ConsentPreferences): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(serializeConsent(preferences))}; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event("flyero:cookie-consent-changed"));
}

export function hasStatisticsConsent(preferences: ConsentPreferences | null): boolean {
  return preferences?.statistics === true;
}
