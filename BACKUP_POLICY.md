# FLYERO Backup-Policy

## Ziel

FLYERO muss Datenverlust begrenzen und einen kontrollierten Restore ermoeglichen.
Diese Policy ergaenzt `BACKUP_RESTORE_RUNBOOK.md`; sie ist kein Nachweis, dass
das externe Ziel auf dem Hetzner-Server bereits aktiv ist.

## Schutzumfang

- PostgreSQL-Datenbank inklusive Migrationstand und Seed-/Konfigurationsstatus.
- `/app/storage` fuer private Dokumente, Uploads und Quarantaene.
- `/app/storage/generated` fuer Rechnungen, Reports und Accounting-Exports.
- Verschluesselte Betriebs- und Restore-Konfiguration ohne Secretwerte im Git.

## Zielwerte

| Ziel | Startwert | Freigabe |
| --- | --- | --- |
| RPO | maximal 24 Stunden, vor zahlenden Kunden mindestens zweimal taeglich | Betreiber |
| RTO | innerhalb eines Arbeitstages nach isolierter Wiederherstellung | Betreiber |
| Aufbewahrung | 7 Tages-, 4 Wochen-, 12 Monats-Snapshots | Datenschutz/Betreiber |
| Restore-Test | mindestens monatlich in isolierter Umgebung | Betreiber |

## Technische Mindestkontrollen

- Backupziel ist physisch/logisch ausserhalb des Produktionscontainers.
- Restic-Repository ist verschluesselt und nur mit minimalen Rechten erreichbar.
- Snapshots werden nach Lauf, Alter, Integritaet und Speicherplatz ueberwacht.
- Backups duerfen nicht im Public-Webroot liegen.
- Datenbank und beide privaten Storagebereiche werden gemeinsam versioniert,
  damit Reports und Metadaten konsistent restauriert werden koennen.
- Ein Restore darf nicht direkt auf Produktion geuebt werden.

## Nachweis pro Lauf

Zu jedem produktiven Backup werden Zeitpunkt, Snapshot-ID, Umfang, Exit-Code,
Integritaetspruefung, Fehler, Operator und Alarmstatus dokumentiert. Secretwerte,
Passwoerter und vollstaendige Kundendaten gehoeren nicht in den Nachweis.

## Restore-Abnahme

Ein isolierter Restore prueft mindestens Datenbankmigration, Login, Kundenauftrag,
Rechnung, Report-/Dokumentdownload, Admin-Login, Tenant-Scope und `/api/health`.
Das Ergebnis enthaelt Snapshot-ID, Dauer, Fehler, Datenzaehler und Freigabe.

## Offener Betriebsstatus

Repository-seitig sind Timer, Restic-Skript, Backup-Config-Smoke und Runbook
vorbereitet. Das externe Hetzner-Ziel, die initiale Migration, Alarmierung und
ein echter isolierter Restore muessen noch auf dem Server ausgefuehrt und
belegt werden.
