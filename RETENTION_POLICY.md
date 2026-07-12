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

Die Fristen sind über `RETENTION_VERIFICATION_TOKEN_DAYS`, `RETENTION_SESSION_DAYS` und `RETENTION_RATE_LIMIT_BUCKET_DAYS` konfigurierbar.

## Ausdrücklich nicht automatisch gelöscht

`GpsPoint`, `PhotoProof`, `Document`, `AuditLog` und `Invoice` werden nicht durch diesen generischen Job gelöscht. Dafür müssen Zweckbindung, Kundenvertrag, gesetzliche Aufbewahrung, Berichtsversionen, Legal Hold und die externe Nachweisquelle fachlich und rechtlich festgelegt werden.

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
