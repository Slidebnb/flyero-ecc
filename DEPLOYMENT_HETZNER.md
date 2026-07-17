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

## Automatischer E-Mail-Worker

Benachrichtigungen werden zuerst dauerhaft in der Datenbank-Queue gespeichert. In
Produktion verarbeitet ein eigener Systemd-Timer diese Queue jede Minute. Der
Worker ruft den bestehenden internen Endpoint auf; der Token darf niemals in
GitHub, Logs oder Chat kopiert werden.

Beim ersten Einrichten auf dem Server:

```bash
cd /opt/flyero
grep -q '^INTERNAL_API_TOKEN=' .env.production || printf 'INTERNAL_API_TOKEN="%s"\n' "$(openssl rand -hex 32)" >> .env.production
chmod +x scripts/process-notifications.sh scripts/install-notification-worker-systemd.sh
docker compose --env-file .env.production -f docker-compose.production.yml build app
docker compose --env-file .env.production -f docker-compose.production.yml up -d app
docker compose --env-file .env.production -f docker-compose.production.yml exec app node scripts/production-preflight.mjs
sudo bash scripts/install-notification-worker-systemd.sh
sudo systemctl status flyero-notification-worker.timer --no-pager
sudo systemctl start flyero-notification-worker.service
sudo journalctl -u flyero-notification-worker.service -n 80 --no-pager
```

Bei kuenftigen Updates reichen Pull, Build und eine erneute Aktivierung des
Timers:

```bash
cd /opt/flyero
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.production.yml build app
docker compose --env-file .env.production -f docker-compose.production.yml up -d app
sudo bash scripts/install-notification-worker-systemd.sh
```

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
EMAIL_FROM="FLYERO <hallo@flyero.org>"
RESEND_API_KEY="..."
```

Alternativ SMTP:

```env
EMAIL_PROVIDER="smtp"
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
SMTP_FROM="FLYERO <hallo@flyero.org>"
```

## Updates

Wichtig: `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` wird von Next.js beim Image-Build
in den Browser-Bundle eingebaut. Deshalb muss `--env-file .env.production` beim
`build`-Befehl stehen. Ohne diese Option kann der laufende Container den Key zwar
als Runtime-ENV sehen, die Browserkarte bleibt aber im bereits gebauten Bundle
leer und fällt auf den Fallback zurück. Der Docker-Build bricht bei fehlendem Key
jetzt absichtlich ab.

```bash
cd /opt/flyero
git pull
docker compose --env-file .env.production -f docker-compose.production.yml build app
docker compose -f docker-compose.production.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml run --rm app npm run pricing:sync-premium
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs -f app

# Alle öffentlichen SEO-Seiten gegen die laufende Domain prüfen.
SITEMAP_BASE_URL=https://flyero.org npm run test:public-sitemap-runtime
```

## Checks

```bash
curl -I https://flyero.org
curl https://flyero.org/api/health
SITEMAP_BASE_URL=https://flyero.org npm run test:public-sitemap-runtime
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 app
docker compose -f docker-compose.production.yml logs --tail=100 caddy
```

Ein `200` von `/api/health` allein ist keine Produktionsfreigabe. Der Sitemap-
Runtime-Check muss ebenfalls erfolgreich sein. Bei einem `500` auf einer
öffentlichen Seite zuerst `npx prisma migrate deploy` ausführen und danach
Build, Containerstart und den Sitemap-Check wiederholen.

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
