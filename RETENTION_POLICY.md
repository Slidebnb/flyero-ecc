# FLYERO Aufbewahrung und Bereinigung

Stand: 13.07.2026

## Grundsatz

Die Bereinigung läuft standardmäßig nur als Dry-Run. Ein echter Purge muss ausdrücklich mit `--apply` und `RETENTION_APPLY=true` aktiviert werden. Der Prozess gibt nur Mengen und Zeitpunkte aus, keine Tokens, IPs, GPS-Punkte oder Dateiinhalte.

## Automatisierbare Ablaufdaten

| Datenklasse | Standardfrist | Bereinigung |
| --- | ---: | --- |
| Nicht mehr gültige oder alte verwendete E-Mail-Verifizierungstoken | 7 Tage | `EmailVerificationToken` |
| Abgelaufene Sessions und alte widerrufene Sessions | 30 Tage | `AuthSession` |
| Inaktive Auth-Rate-Limit-Buckets | 7 Tage | `AuthRateLimitBucket` |
| Inaktive öffentliche Rate-Limit-Buckets | 7 Tage | `PublicRateLimitBucket` |

Die Fristen sind über `RETENTION_VERIFICATION_TOKEN_DAYS`, `RETENTION_SESSION_DAYS` und `RETENTION_RATE_LIMIT_BUCKET_DAYS` konfigurierbar.

## Ausdrücklich nicht automatisch gelöscht

`GpsPoint`, `PhotoProof`, `Document`, `AuditLog` und `Invoice` werden nicht durch diesen generischen Job gelöscht. Dafür müssen Zweckbindung, Kundenvertrag, gesetzliche Aufbewahrung, Berichtsversionen, Legal Hold und die externe Nachweisquelle fachlich und rechtlich festgelegt werden.

## Legal Holds

Die Fristen `RETENTION_GPS_RAW_REVIEW_DAYS` und `RETENTION_REJECTED_PHOTO_REVIEW_DAYS` steuern nur die Kandidatenliste fuer die rechtliche Pruefung. Sie geben keine automatische Loeschung von GPS- oder Fotodaten frei.

Fuer einen Auftrag kann ein Admin eine `RetentionHold` mit Grund, optionalem
Aktenzeichen und Ablaufdatum setzen. Solange die Sperre aktiv ist, werden
zugehoerige GPS- und Foto-Daten im Retention-Dry-Run nicht als freigegeben fuer
eine spaetere Bereinigung gezaehlt. Erstellen und Aufheben werden auditiert.

Die API ist auf `RETENTION_HOLD_MANAGE` beschraenkt:

```text
POST /api/admin/retention-holds
GET  /api/admin/retention-holds?orderId=...
PATCH /api/admin/retention-holds/:id
```

Der Dry-Run weist alte, abgeschlossene GPS-Punkte und abgelehnte, nicht
kundensichtbare Fotos ohne aktive Sperre als `forLegalReview` aus. Das ist
bewusst nur eine Pruefliste und keine automatische Loeschfreigabe.

## Betrieb

Bericht ausführen:

```bash
npm run retention:report
```

Produktiven Purge nur nach geprüfter Policy aktivieren:

```bash
RETENTION_APPLY=true npm run retention:purge
```

Auf Windows PowerShell:

```powershell
$env:RETENTION_APPLY = "true"
npm run retention:purge
```

Der Job sollte später über einen dedizierten Scheduler oder Worker laufen. Ein Webrequest darf keinen Purge auslösen.
