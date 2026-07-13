# FLYERO Deployment auf Hetzner

Diese Anleitung beschreibt den einfachen MVP-Produktionsbetrieb auf einem Hetzner-Server mit Docker Compose, Postgres und Caddy.

## DNS

Bei IONOS:

```text
A      @      167.235.238.254
A      www    167.235.238.254
```

## Serverstruktur

```text
/opt/flyero
  Dockerfile
  docker-compose.production.yml
  Caddyfile
  .env.production
```

## Erstes Deployment

```bash
sudo mkdir -p /opt/flyero
sudo chown -R flyero:flyero /opt/flyero
cd /opt/flyero
git clone https://github.com/Slidebnb/flyero-ecc.git .
cp .env.production.example .env.production
nano .env.production
ENV_FILE=.env.production npm run production:preflight
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d postgres
docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml run --rm app npm run pricing:sync-premium
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml ps
```

## Automatische Backups

Backups sind nur belastbar, wenn das externe Restic-Ziel eingerichtet und der Timer aktiviert ist. Die Einrichtung ist in `BACKUP_RESTORE_RUNBOOK.md` beschrieben; der versionierte Installer ist:

```bash
cd /opt/flyero
sudo bash scripts/install-backup-systemd.sh
sudo systemctl status flyero-backup.timer
```

Ohne `/etc/flyero/backup.env` und `/etc/flyero/restic-password` bricht der Installer ab. Ein erfolgreicher GitHub-Push oder ein laufender App-Container ist kein Backupnachweis.

## ENV-Pflichtwerte

```env
POSTGRES_PASSWORD="..."
DATABASE_URL="postgresql://flyero:...@postgres:5432/flyero?schema=public"
AUTH_SECRET="..."
APP_URL="https://flyero.org"
NEXT_PUBLIC_SITE_URL="https://flyero.org"
```

Für echte Registrierungs-E-Mails:

```env
EMAIL_PROVIDER="resend"
EMAIL_FROM="FLYERO <noreply@flyero.org>"
RESEND_API_KEY="..."
```

Alternativ SMTP:

```env
EMAIL_PROVIDER="smtp"
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="FLYERO <noreply@flyero.org>"
```

## Updates

```bash
cd /opt/flyero
git pull
docker compose --env-file .env.production -f docker-compose.production.yml build app
docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml run --rm app npm run pricing:sync-premium
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs -f app
```

## Checks

```bash
curl -I https://flyero.org
curl https://flyero.org/api/health
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 app
docker compose -f docker-compose.production.yml logs --tail=100 caddy
```

## Produktions-Preflight

Vor jedem Produktionsstart ausfuehren:

```bash
ENV_FILE=.env.production npm run production:preflight
```

Der Check gibt keine Secretwerte aus und lehnt Mock-Zahlungen, Mock-E-Mail, lokalen Storage, fehlenden Malware-Scan sowie fehlende Backup- und Provider-Konfiguration ab. Er wird bewusst manuell ausgefuehrt, damit lokale Beta- und Migrationsprozesse nicht automatisch blockiert werden.

Das Produktionsimage installiert ClamAV. Nach dem Image-Build sollte der
Preflight deshalb auch im App-Container ausgefuehrt werden, damit der
konfigurierte Scannerpfad zur Laufzeit vorhanden ist:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm --no-deps app npm run production:preflight
```

## Hinweise

- Postgres ist nur im Docker-Netz erreichbar.
- Caddy verwaltet HTTPS-Zertifikate automatisch.
- Lokal liegen private Dokumente und Generated-Assets unter `storage` beziehungsweise `storage/generated` in Docker-Volumes. `public/generated` ist kein Produktionsspeicher für Rechnungen oder Reports. Für den öffentlichen Betrieb soll `FILE_STORAGE_PROVIDER=s3` auf einen privaten S3-kompatiblen Bucket zeigen; Einrichtung und Migration sind in `PRIVATE_OBJECT_STORAGE.md` beschrieben.

### Migration des Generated-Volumes

Vor dem ersten Neustart mit dem korrigierten Mount muss ein bereits laufender
Stack geprüft werden. Der neue Mount `app_generated:/app/storage/generated`
überdeckt den bisherigen Unterordner im `app_storage`-Volume. Falls dort schon
Generated-Assets liegen, müssen sie vor dem Umschalten kontrolliert in das neue
Volume kopiert und stichprobenartig über die geschützten Download-Routen geprüft
werden. Diese Migration ist bewusst kein automatischer Startschritt.
- Keine Demo-Seeds in echter Produktion ausführen, außer bewusst für eine geschlossene Beta.
