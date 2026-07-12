# Auth-Session-Betrieb

## Zweck

FLYERO verwendet weiterhin einen signierten HTTP-only-Cookie. Der Cookie enthält eine signierte `sessionId`; die Berechtigung wird bei jedem serverseitig geschützten Zugriff zusätzlich aus `AuthSession` und `User` in PostgreSQL gelesen.

Damit gelten Rollen und Kontostatus nicht mehr bis zum Ablauf eines alten JWT. Eine Deaktivierung, Sperrung oder Rollenänderung wirkt beim nächsten API-Zugriff.

## Lebenszyklus

1. Erfolgreicher Login legt eine `AuthSession` mit sieben Tagen Ablaufzeit an.
2. Die Session-ID wird signiert in den Cookie geschrieben.
3. `getSession()` prüft JWT-Signatur, Session-ID, Ablauf, Widerruf und den aktuellen `User.status`.
4. Die aktuelle Rolle und Warehouse-Zuordnung stammen aus der Datenbank, nicht aus alten JWT-Claims.
5. Logout markiert die Session als widerrufen und löscht den Cookie.
6. Abgelaufene oder widerrufene Sessions werden nicht autorisiert.

## Gespeicherte Daten

`AuthSession` speichert nur die für Betrieb und Sicherheitsanalyse nötigen Werte:

- Benutzerreferenz
- Ablauf- und Widerrufszeitpunkt
- letzter technischer Zugriffspunkt, maximal einmal pro fünf Minuten aktualisiert
- optional gekürzte IP-Adresse und User-Agent des Logins
- Erstellungszeitpunkt

IP- und User-Agent-Werte sind technische Sicherheitsmetadaten. Ihre Aufbewahrung und Löschung müssen mit dem Datenschutzkonzept und der finalen Rechtsgrundlage abgestimmt werden.

## Betrieb und Migration

- Migration: `20260712125545_auth_sessions`
- Lokale Datenbank: PostgreSQL auf `127.0.0.1:5432`
- Produktion: Migrationen ausschließlich über `npx prisma migrate deploy`
- Ein Rollback durch manuelles Löschen der Tabelle ist nicht zulässig.

Nach einem Deploy werden ältere Cookies ohne `sessionId` bewusst abgelehnt. Betroffene Benutzer müssen sich einmal neu anmelden.

## Verifikation

Der Test `npm run test:auth-session` prüft:

- aktive Session wird akzeptiert,
- Session-Widerruf führt zu `401`,
- eine geänderte DB-Rolle überschreibt die alte JWT-Rolle,
- ein deaktivierter Benutzer verliert sofort den Zugriff.

Offen bleiben Geräteverwaltung, „Logout aller Geräte“, MFA/WebAuthn und ein automatischer Retention-Job für alte Sessionzeilen.
