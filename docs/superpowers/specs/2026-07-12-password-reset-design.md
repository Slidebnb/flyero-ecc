# Passwort-Reset: Sicherheitsdesign

## Ziel

Kunden und interne Nutzer sollen verlorene Passwörter selbstständig zurücksetzen können, ohne dass FLYERO verrät, ob eine E-Mail-Adresse registriert ist.

## Ablauf

1. `POST /api/auth/request-password-reset` akzeptiert eine E-Mail-Adresse und antwortet bei gültiger Eingabe immer mit derselben neutralen Nachricht.
2. Für einen aktiven Nutzer wird ein zufälliger Token erzeugt. In PostgreSQL wird ausschließlich dessen SHA-256-Hash mit Nutzerbezug, Ablaufzeit und Verbrauchszeit gespeichert.
3. Die bestehende E-Mail-Abstraktion versendet einen Link auf `/reset-password`.
4. `POST /api/auth/reset-password` prüft Hash, Ablauf und Einmalverwendung in einer Transaktion, setzt den Passwort-Hash, markiert den Token als verwendet und widerruft alle bestehenden Sessions.
5. Die erfolgreiche Änderung wird ohne Passwort- oder Tokenwerte im AuditLog protokolliert.

## Sicherheitsentscheidungen

- Token ist einmalig und 30 Minuten gültig.
- Vorhandene Reset-Tokens des Nutzers werden bei einer neuen Anfrage invalidiert.
- Anfrage und Abschluss sind DB-gestützt rate-limitiert.
- Die Anfrage verrät weder für unbekannte noch für gesperrte Konten einen Unterschied.
- Antworten enthalten keine Zugangsdaten, Tokens, Cookie-Werte oder vollständigen Request-Bodies.
- Passwortanforderung bleibt mindestens 10 Zeichen und entspricht der bestehenden Registrierungsregel.
- `AUTH_SECRET`, Datenbank-Port und bestehende Session-Cookie-Konfiguration bleiben unverändert.

## Nicht Bestandteil

MFA, Passwort-Historie, kompromittierte-Passwort-Prüfung und Self-Service-Geräteverwaltung bleiben getrennte Folgepakete.
