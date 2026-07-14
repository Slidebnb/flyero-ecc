# Adminbetrieb mit echten Daten

## Produktionsregel

Produktionsseiten lesen ausschließlich persistierte, echte Datensätze aus Prisma. Es gibt keinen lokalen Orts-/PLZ-Fallback mehr in der Suche. Vorschläge stammen aus:

- Google Places/Geocoding, wenn der konfigurierte Google-Server-Key verfügbar ist
- aktiven, wiederverwendbaren `DistributionArea`-Datensätzen, die im Adminbereich gepflegt wurden

Wenn keine Datenquelle verfügbar ist, bleibt die Liste leer und die Oberfläche fordert eine echte Konfiguration an. Es werden keine Orte, Haushalte, Lager oder Preise erfunden.

## Lagerverwaltung

Administratoren verwalten Lager unter `/admin/settings/warehouses` und `/admin/logistics`.

- Neue Lager werden mit `isDemoData=false` gespeichert.
- Name, Code, Adresse, Region, Kapazität, Ansprechpartner, Öffnungszeiten und Status sind bearbeitbar.
- Lager können deaktiviert werden, ohne Auftrags- oder Berichtshistorie zu zerstören.
- Löschen ist nur möglich, wenn keine Mitarbeiter, Aufträge, Teilgebiete, Bestände, Druckaufträge, Sendungen, Umlagerungen oder Inventuren auf das Lager verweisen.
- Bei vorhandenen Verknüpfungen bleibt nur die Deaktivierung möglich.
- Jede Änderung und Löschung wird im Audit-Log dokumentiert.

Die Migration `20260714120000_warehouse_demo_source` ergänzt die Kennzeichnung. Die Folgemigration `20260714121000_mark_existing_demo_warehouses` markiert ausschließlich eindeutig erkennbare `demo-`-Lager beziehungsweise Notizen mit `demo`/`seed`; sie löscht keine Daten.

## Seed-Daten

`prisma/seed.mjs` ist für isolierte Entwicklung und Smoke-Tests vorgesehen. In Produktion bricht der Seed ab, wenn nicht ausdrücklich `SEED_DEMO_DATA=true` gesetzt ist. Dieses Flag darf nicht auf dem Live-System gesetzt werden.

Beispiel für eine Testumgebung:

```text
NODE_ENV=test SEED_DEMO_DATA=true npm run prisma:seed
```

Ein bereits mit Demo-Daten befülltes Produktionssystem wird nicht automatisch gelöscht. Vor einer Bereinigung muss ein überprüftes Backup vorhanden sein; die Bereinigung ist ein separater, freizugebender Betriebsjob und kein Bestandteil eines normalen Deployments.

## Firmen- und Branding-Einstellungen

Fehlende Firmendaten erzeugen keine Musteradresse, Demo-Bank oder Test-Steuernummer mehr. Das Adminformular bleibt leer, bis echte Daten gepflegt wurden. Gleiches gilt für einen fehlenden Rechnungsfooter.

## Prüfung nach Deployment

```text
npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml up -d --force-recreate app
docker compose --env-file .env.production -f docker-compose.production.yml exec app node scripts/production-preflight.mjs
curl -fsS https://flyero.org/api/health
```

Danach im Adminbereich prüfen:

1. `/admin/settings/warehouses` zeigt nur echte Lager oder den Leerzustand.
2. Ein neues Lager lässt sich anlegen und bearbeiten.
3. Ein ungenutztes Testlager lässt sich nach Bestätigung löschen.
4. Ein referenziertes Lager wird nicht gelöscht, sondern verständlich zur Deaktivierung aufgefordert.
5. `/admin/logistics` und die Gebiets-/Auftragsplanung verwenden nur aktive echte Lager.
