# FLYERO Backup- und Restore-Runbook

Stand: 12.07.2026

Dieses Runbook beschreibt den technischen Backup-Pfad fuer die Einzelserver-Beta. Es ersetzt keine externe Backup- oder Datenschutzfreigabe. Die Backup-Dateien muessen ausserhalb des Hetzner-Servers liegen.

## Zielbild und Betriebsgrenzen

- Datenbank: PostgreSQL-Custom-Dump aus dem laufenden Compose-Postgres.
- Nachweise: `/app/storage` mit privaten Dokumenten und `/app/public/generated` mit Rechnungen, Reports und Accounting-Exports.
- Verschluesselung: Restic verschluesselt das Repository clientseitig.
- Ziel: Hetzner Storage Box per SFTP oder ein kompatibles privates S3-Repository.
- Kein Backupziel darf im oeffentlichen Webroot liegen.
- Keine Secrets: Passwort, SSH-Key oder Restic-Secret wird in Git, `.env.example` oder Logs gespeichert.

## Zielwerte

- RPO: maximal 24 Stunden bei taeglichem Backup. Fuer den ersten zahlenden Kunden sollte auf mindestens zweimal taeglich erhoeht werden.
- RTO: maximal 4 Stunden fuer Wiederanlauf mit einem verfuegbaren Hetzner-Server und einem geprueften Snapshot.
- Aufbewahrung: 7 Tages-, 4 Wochen- und 12 Monats-Snapshots als Startwert.
- Restore-Test: monatlich in einer isolierten Staging-Umgebung, niemals direkt auf Produktion.

## Einmalige Servereinrichtung

1. `restic` auf dem Hetzner-Server installieren und Version dokumentieren.
2. Einen privaten Storage-Box-SFTP-Account oder ein privates S3-Repository anlegen.
3. Eine nur fuer FLYERO verwendete Passwortdatei ausserhalb des Repos anlegen, zum Beispiel `/etc/flyero/restic-password`, mit Besitzer `root` oder `flyero` und Modus `0600`.
4. `BACKUP_RESTIC_REPOSITORY` und `BACKUP_RESTIC_PASSWORD_FILE` in der Produktionsumgebung setzen.
5. Das Repository einmalig mit `restic init` initialisieren.
6. Einen manuellen Backup-Lauf ausfuehren und mit `restic snapshots` pruefen.
7. Einen Cronjob oder systemd-Timer mit eingeschraenktem Service-User einrichten. Der Job darf nur auf Docker Compose und das Restic-Repository zugreifen.

Beispiel fuer die nicht geheimen Variablen:

```env
BACKUP_RESTIC_REPOSITORY="sftp:backup-user@storagebox.example:/home/backup-user/flyero"
BACKUP_RESTIC_PASSWORD_FILE="/etc/flyero/restic-password"
BACKUP_RETENTION_DAILY="7"
BACKUP_RETENTION_WEEKLY="4"
BACKUP_RETENTION_MONTHLY="12"
```

## Backup ausfuehren

```bash
cd /opt/flyero
set -a
. ./.env.production
set +a
bash scripts/backup-production.sh
restic snapshots --tag flyero-production
```

Das Skript schreibt zuerst in einen restriktiven temporaeren Ordner, erstellt dann Datenbank- und Storage-Archive, schreibt SHA-256-Pruefsummen und uebergibt nur diese Artefakte verschluesselt an Restic. Bei einem Fehler wird der temporaere Ordner geloescht.

## Verify-only Restore

Der Standardmodus veraendert keine laufende Anwendung:

```bash
cd /opt/flyero
set -a
. ./.env.production
set +a
export RESTIC_SNAPSHOT_ID="<gepruefte-snapshot-id>"
bash scripts/restore-production.sh
```

Das Skript laedt den Snapshot in ein temporaeres Verzeichnis, prueft Manifest und Checksummen und beendet sich danach ohne Datenbank- oder Storage-Schreibzugriff.

## Staging-Restore

Ein echter Restore wird ausschliesslich in einer isolierten Staging-Umgebung geuebt. Vorher muessen Datenbank, Storage, Ziel-Compose-Projekt, Snapshot und Betreiber dokumentiert werden. Danach koennen die Flags einzeln aktiviert werden:

```bash
export ALLOW_DESTRUCTIVE_RESTORE=true
export RESTORE_DATABASE=true
export RESTORE_STORAGE=true
export RESTORE_GENERATED=true
bash scripts/restore-production.sh
```

Nie alle Flags blind auf Produktion setzen. Vor jedem produktiven Restore muss ein Incident-/Change-Eintrag mit Freigabe, Snapshot-ID und Rueckfallplan existieren. Nach dem Restore sind `/api/health`, Login, Kundenreport-Download, Rechnungsdownload, Admin-Login und ein Read-only-Seitentest zu pruefen.

## Wiederherstellungsreihenfolge

1. Hetzner-Server und Docker bereitstellen.
2. Repository und Restic-Passwortzugriff pruefen.
3. PostgreSQL-Container starten und Migrationen auf den passenden Code-Stand anwenden.
4. Verify-only Restore durchfuehren.
5. Datenbank wiederherstellen.
6. Private Dokumente und generierte Dateien wiederherstellen.
7. Container neu starten und Healthcheck abwarten.
8. Kritische Smoke-Checks ausfuehren.
9. Restore-Ergebnis, Dauer, Snapshot, Fehler und Datenpruefung dokumentieren.

## Offene Betreiberaufgaben

- Echten Hetzner-Storage-Box-Account und Restic-Repository einrichten.
- Cron/systemd-Timer mit Fehleralarm einrichten.
- Verschluesseltes Backupziel und Zugriffskontrolle dokumentieren.
- Ersten Staging-Restore nachweisen.
- RPO/RTO nach realer Laufzeit bestaetigen.
