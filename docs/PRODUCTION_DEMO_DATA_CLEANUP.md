# Produktionsbereinigung von Demo- und Seed-Daten

## Grundregel

`prisma db seed` ist in Produktion gesperrt. In `.env.production` muss
`SEED_DEMO_DATA="false"` gesetzt sein. Neue Aufträge, Kunden, Lager und
Nachweise entstehen ausschließlich durch echte Prozesse.

Die Admin-Listen wenden zusätzlich eine Produktions-Datenrichtlinie an. Sie
blendet bekannte Seed-Marker aus, darunter `DEMO-*`-Aufträge,
`@example.com`-Konten, Seed-Gebiete, Seed-Leads, Seed-Dokumente,
Seed-Druckpartner, Seed-Buchhaltungsexporte, Seed-Nachrichten und bekannte
Seed-Queue-/Monitoring-Einträge aus. Bekannte Seed-Firmen- und
Brandingwerte werden bei der Bereinigung ebenfalls entfernt.

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
Die Bereinigung wurde nicht als normaler Deploy-Schritt ausgeführt. Nach dem
Deploy muss der Admin die Vorschau auf dem Produktionsserver prüfen und den
Apply-Befehl bewusst ausführen. Die Ausgabe muss danach für alle Prüfkategorien
`0` zeigen, außer für echte, ausdrücklich erhaltene Konten.

## Lagerverwaltung

Admins können echte Lager über `/admin/settings/warehouses` anlegen, ändern und
löschen. Ein Lager mit Aufträgen, Bestand, Sendungen, Transfers oder Personal
wird aus Sicherheitsgründen nicht physisch gelöscht; es wird stattdessen
deaktiviert. Dadurch bleiben historische Nachweise und Buchungsbeziehungen
intakt.

## Zusaetzliche Seed-Reste

Die Bereinigung umfasst auch Zahlungsereignisse mit `evt_seed_` oder
`payload.seed=true`, UX-Ereignisse aus `seed.*`, seed-markierte Auditlogs und
Demo-Lagerregionen. Logeintraege, die auf Demo-Logistikobjekte zeigen, werden
vor deren Loeschung entfernt. Produktionsanalysen filtern diese UX- und
Auditdaten zusaetzlich zur eigentlichen Loeschung aus.
