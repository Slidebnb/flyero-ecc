# AuditLog v2

## Zweck

Sicherheitsrelevante Aktionen sollen nachträglich nachvollziehbar sein, ohne Passwörter, Tokens oder komplette Request-Bodies zu speichern. `AuditLog` bleibt eine technische Ereignistabelle und ersetzt keine unveränderliche externe Compliance-Archivierung.

## Gespeicherte Angaben

- Aktion, Objektart und Objekt-ID
- Benutzer-ID, sofern ein eingeloggter Benutzer vorhanden ist
- alte und neue Werte nur, wenn der jeweilige Aufrufer sie bewusst übergibt
- `requestId` zur Korrelation mit Reverse-Proxy-/Anwendungslogs
- `ipAddress` aus dem ersten vertrauenswürdigen Proxy-Wert, sofern vorhanden
- gekürzter `userAgent` (maximal 512 Zeichen)
- `result`, standardmäßig `SUCCESS`
- Erstellzeitpunkt

Die Request-ID wird aus `x-request-id` übernommen, wenn sie dem erlaubten Format entspricht; sonst wird serverseitig eine UUID erzeugt. IP-Adresse und User-Agent sind personenbezogene Betriebsdaten und müssen bei Aufbewahrung, Zugriff und Löschung in die Datenschutzprüfung einbezogen werden.

## Aktueller Umfang

Login und Logout schreiben den Request-Kontext bereits mit. Die übrigen bestehenden `createAuditLog`-Aufrufe bleiben kompatibel und erhalten bis zur gezielten Anbindung keinen künstlichen Kontext. Dadurch werden keine falschen Sicherheitszusagen für bereits historische Ereignisse erzeugt.

## Schutzregeln

- Keine Passwörter, Session-Tokens, Cookie-Werte oder vollständigen Upload-Inhalte in Audit-Feldern speichern.
- Keine unvalidierten Header-Längen in die Datenbank übernehmen.
- `result` bleibt ein kontrollierter Status-String wie `SUCCESS`, `DENIED` oder `FAILURE`.
- Kunden erhalten niemals direkten Zugriff auf Audit-Logs.
- Audit-Zugriffe und Exporte müssen weiterhin über die Admin-Berechtigungen laufen.

## Nachtrag 13.07.2026

- Der Proxy setzt fuer alle gematchten API-Routen eine validierte Request-ID und
  gibt sie in der Response zurueck.
- `createAuditLog()` liest den aktuellen Request-Kontext serverseitig automatisch
  ueber `next/headers`; kritische Spezialpfade wie der Stripe-Webhook uebergeben
  den Kontext zusaetzlich explizit.
- Offen bleiben ein externes manipulationsgeschuetztes Logziel, verbindliche
  Aufbewahrung, historische Logmigration und die vollstaendige fachliche
  Anbindung aller Hintergrundprozesse.

## Offener Ausbau

Für eine vollständige zentrale Korrelation sollten später Webhooks, Zahlungsaktionen, Dokumentfreigaben und Berichtspublikationen ebenfalls `auditRequestContext(request)` übergeben. Für revisionsrelevante Produktion ist zusätzlich ein externes, manipulationsgeschütztes Logziel mit geprüfter Aufbewahrung erforderlich.

## Lokale Integritaetskette

Seit der Migration `20260713160000_audit_log_integrity` speichert jeder neue
Audit-Eintrag einen SHA-256-`integrityHash` sowie den Hash des vorherigen
Eintrags in `previousIntegrityHash`. Die Erstellung wird innerhalb einer
PostgreSQL-Transaktion mit einem Advisory Lock serialisiert, damit parallele
Requests keine unerkannte lokale Kette aufspalten.

`verifyAuditLogIntegrity()` prueft die gespeicherten Hashes und die Verweise
auf den vorherigen Eintrag. Historische Eintraege vor dieser Migration bleiben
ohne Hash und bilden bewusst keinen nachtraeglich erfundenen Integritaetsnachweis.

Die Kette ist ein lokaler Manipulationsnachweis, keine unveraenderliche
Compliance-Archivierung: Ein privilegierter Datenbankzugriff kann weiterhin
Zeilen und die Kette gemeinsam veraendern. Vor einem echten Launch braucht es
deshalb weiterhin ein externes WORM-/SIEM-Ziel, eingeschraenkte DB-Rechte und
regelmaessige unabhaengige Integritaetspruefungen.
