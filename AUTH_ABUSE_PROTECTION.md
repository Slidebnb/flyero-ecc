# Auth-Abuse-Schutz

FLYERO schützt die öffentlichen Authentifizierungswege mit PostgreSQL-Buckets. Die Begrenzung liegt damit nicht nur in einer einzelnen Node.js-Prozessinstanz und bleibt bei mehreren App-Prozessen wirksam.

## Geschützte Wege

| Weg | Standardlimit | Zeitraum | Schlüssel |
| --- | ---: | ---: | --- |
| Login | 10 pro IP und 5 pro Konto | 15 Minuten | IP und normalisierte E-Mail |
| Kunden-/Verteilerregistrierung | 5 | 1 Stunde | IP |
| Bestätigungslink erneut senden | 3 | 1 Stunde | IP und E-Mail |
| E-Mail-Verifizierung | 10 | 15 Minuten | IP |
| Passwort-Reset | 5 | 1 Stunde | IP |

Alle Limits können über die `AUTH_*_RATE_LIMIT_*`-Variablen angepasst werden. Ein abgelehneter Versuch liefert `429` und `Retry-After`.

## Datenmodell und Datenschutz

`AuthRateLimitBucket.id` ist ein SHA-256-Hash aus Zweck, Bucket-Art und Schlüssel. E-Mail-Adressen und IP-Adressen werden nicht im Bucket gespeichert. Die Tabelle enthält nur Fensterbeginn, Versuchszähler, Sperrzeitpunkt und technische Zeitstempel.

Die Buckets müssen über einen geplanten Retention-Job bereinigt werden. Bis dahin bleiben alte Buckets eine begrenzte technische Schuld und dürfen nicht als dauerhafte Benutzerhistorie verwendet werden.

## Grenzen

Die DB-Lösung ist für die aktuelle Einzelserver-/kleine Beta-Phase geeignet und prozessübergreifend. Vor hoher Last sollte ein zentraler Redis-/Managed-Rate-Limiter mit atomaren Increment-Operationen und Monitoring evaluiert werden. CAPTCHA, WAF-Regeln und IP-Reputation bleiben zusätzliche Schutzschichten für einen öffentlichen Launch.

## Verifikation

`npm run test:auth-abuse` prüft die Einbindung in Login, Kundenregistrierung, Verteilerregistrierung, Resend und E-Mail-Verifizierung sowie einen echten Login-Rate-Limit-Fall mit `429` und `Retry-After`.
