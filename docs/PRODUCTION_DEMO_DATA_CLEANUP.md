# Produktionsbereinigung von Demo- und Seed-Daten

## Grundregel

`prisma db seed` ist in Produktion gesperrt. In `.env.production` muss
`SEED_DEMO_DATA="false"` gesetzt sein. Neue Aufträge, Kunden, Lager und
Nachweise entstehen ausschließlich durch echte Prozesse.

Die Admin-Listen wenden zusätzlich eine Produktions-Datenrichtlinie an. Sie
blendet bekannte Seed-Marker aus, darunter `DEMO-*`-Aufträge,
`@example.com`-Konten, Seed-Gebiete, Seed-Leads, Seed-Dokumente,
Seed-Druckpartner und Seed-Buchhaltungsexporte.

## Bereits vorhandene Altlasten

Eine bereits befüllte Produktionsdatenbank wird nicht beim normalen Deploy
automatisch gelöscht. Das schützt echte historische Aufträge und Nachweise.
Für eine kontrollierte Bereinigung steht `scripts/purge-demo-data.mjs` zur
Verfügung. Das Skript läuft standardmäßig nur als Vorschau.

Vor der Anwendung:

1. Hetzner-Backup erfolgreich prüfen.
2. Die echten Konten in `PRESERVE_EMAILS` eintragen.
3. Die Vorschau ohne `--apply` prüfen.
4. Erst danach mit der expliziten Bestätigung anwenden.

Beispiel auf dem Produktionsserver:

```bash
cd /opt/flyero
docker compose --env-file .env.production -f docker-compose.production.yml exec -T app \
  env NODE_ENV=production \
  PRESERVE_EMAILS="admin@flyero.org,support@flyero.org" \
  node scripts/purge-demo-data.mjs
```

Wenn die Vorschau stimmt:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml exec -T app \
  env NODE_ENV=production \
  CONFIRM_DEMO_PURGE=FLYERO_PURGE_DEMO_DATA \
  PRESERVE_EMAILS="admin@flyero.org,support@flyero.org" \
  node scripts/purge-demo-data.mjs --apply
```

Das Skript löscht nur eindeutig markierte Seed-Datensätze. Demo-Lager mit
verbleibenden echten Referenzen werden nicht blind gelöscht und müssen in der
Admin-Lagerverwaltung deaktiviert oder nach Prüfung manuell bereinigt werden.

## Lagerverwaltung

Admins können echte Lager über `/admin/settings/warehouses` anlegen, ändern und
löschen. Ein Lager mit Aufträgen, Bestand, Sendungen, Transfers oder Personal
wird aus Sicherheitsgründen nicht physisch gelöscht; es wird stattdessen
deaktiviert. Dadurch bleiben historische Nachweise und Buchungsbeziehungen
intakt.
