"use client";

export function CookieSettingsLink() {
  return (
    <button
      type="button"
      className="mkFooterCookieLink"
      onClick={() => window.dispatchEvent(new Event("flyero:open-cookie-settings"))}
    >
      Cookie-Einstellungen
    </button>
  );
}
