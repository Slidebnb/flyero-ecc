"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  createConsentPreferences,
  readConsentFromCookieString,
  writeConsentCookie,
} from "@/lib/cookieConsent";

const defaultPreferences = createConsentPreferences({ statistics: false, marketing: false });

function subscribeToCookieChanges(onChange: () => void) {
  window.addEventListener("flyero:cookie-consent-changed", onChange);
  return () => window.removeEventListener("flyero:cookie-consent-changed", onChange);
}

function getCookieSnapshot() {
  return document.cookie;
}

function getServerCookieSnapshot() {
  return "";
}

export function CookieConsent() {
  const cookieString = useSyncExternalStore(subscribeToCookieChanges, getCookieSnapshot, getServerCookieSnapshot);
  const preferences = readConsentFromCookieString(cookieString);
  const [draft, setDraft] = useState(defaultPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const openSettings = () => {
      setDraft(readConsentFromCookieString(document.cookie) ?? defaultPreferences);
      setSettingsOpen(true);
    };
    window.addEventListener("flyero:open-cookie-settings", openSettings);
    return () => window.removeEventListener("flyero:open-cookie-settings", openSettings);
  }, []);

  function save(next: { statistics: boolean; marketing: boolean }) {
    const nextPreferences = createConsentPreferences(next);
    writeConsentCookie(nextPreferences);
    setDraft(nextPreferences);
    setSettingsOpen(false);
  }

  if (settingsOpen) {
    return (
      <section className="cookieConsentRoot" aria-label="Cookie-Einstellungen">
        <div className="cookieConsentPanel" role="dialog" aria-modal="false" aria-labelledby="cookie-settings-title">
          <div className="cookieConsentHeader">
            <div>
              <p className="cookieConsentEyebrow">Deine Auswahl</p>
              <h2 id="cookie-settings-title">Deine Cookie-Einstellungen</h2>
            </div>
            <button className="cookieConsentClose" type="button" onClick={() => setSettingsOpen(false)} aria-label="Schließen">
              ×
            </button>
          </div>
          <p className="cookieConsentText">
            Notwendige Cookies halten FLYERO sicher und funktionsfähig. Optionale Statistik hilft uns, die Website zu verbessern.
            Mehr steht in unserer <a href="/datenschutz">Datenschutzerklärung</a>.
          </p>
          <div className="cookieConsentOptions">
            <div className="cookieConsentOption">
              <div>
                <strong>Notwendig</strong>
                <span>Immer aktiv für Anmeldung, Sicherheit und deine Planung.</span>
              </div>
              <span className="cookieConsentAlways">Immer aktiv</span>
            </div>
            <label className="cookieConsentOption cookieConsentOptionInteractive">
              <span>
                <strong>Statistik</strong>
                <span>Hilft uns, die Nutzung der öffentlichen Seiten zu verstehen.</span>
              </span>
              <input
                type="checkbox"
                checked={draft.statistics}
                onChange={(event) => setDraft((current) => ({ ...current, statistics: event.target.checked }))}
              />
            </label>
            <div className="cookieConsentOption">
              <div>
                <strong>Marketing</strong>
                <span>Derzeit nicht verwendet.</span>
              </div>
              <span className="cookieConsentAlways">Aus</span>
            </div>
          </div>
          <div className="cookieConsentActions">
            <button className="cookieConsentButton cookieConsentButtonSecondary" data-testid="cookie-consent-reject" type="button" onClick={() => save({ statistics: false, marketing: false })}>
              Nur notwendige
            </button>
            <button className="cookieConsentButton cookieConsentButtonSecondary" data-testid="cookie-consent-save" type="button" onClick={() => save(draft)}>
              Auswahl speichern
            </button>
            <button className="cookieConsentButton cookieConsentButtonPrimary" data-testid="cookie-consent-accept" type="button" onClick={() => save({ statistics: true, marketing: false })}>
              Alle akzeptieren
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (preferences) return null;

  return (
    <section className="cookieConsentRoot" aria-label="Cookie-Hinweis">
      <div className="cookieConsentBanner" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" data-testid="cookie-consent-banner">
        <div>
          <p className="cookieConsentEyebrow">Deine Privatsphäre</p>
          <h2 id="cookie-consent-title">Cookies, die zu dir passen</h2>
          <p className="cookieConsentText">
            Notwendige Cookies halten FLYERO sicher und funktionsfähig. Optionale Statistik ist standardmäßig ausgeschaltet und wird nur mit deiner Zustimmung genutzt.
            <a href="/datenschutz">Mehr erfahren</a>
          </p>
        </div>
        <div className="cookieConsentActions">
          <button className="cookieConsentButton cookieConsentButtonSecondary" data-testid="cookie-consent-reject" type="button" onClick={() => save({ statistics: false, marketing: false })}>
            Nur notwendige
          </button>
          <button className="cookieConsentButton cookieConsentButtonSecondary" type="button" onClick={() => setSettingsOpen(true)}>
            Einstellungen
          </button>
          <button className="cookieConsentButton cookieConsentButtonPrimary" data-testid="cookie-consent-accept" type="button" onClick={() => save({ statistics: true, marketing: false })}>
            Alle akzeptieren
          </button>
        </div>
      </div>
    </section>
  );
}
