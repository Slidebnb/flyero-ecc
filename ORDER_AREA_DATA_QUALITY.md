# FLYERO Order Area Data Quality

Stand: 2026-07-10

## Kurzfazit

Die Haushaltszahlen im Kunden-Bestellflow sind aktuell keine amtlichen oder lizenzierten Post-/Geomarketing-Haushaltsdaten. Sie werden aus vorhandenen FLYERO-Gebietsdaten berechnet.

Aktuelle Quellen:

- `DistributionArea.estimatedHouseholds`
- optionale `AreaHouseholdEstimate`-Einträge
- bei Demo-/Seed-Daten: `AreaHouseholdEstimate.method = SEED`, `source = module8-seed`
- bei frei gezeichneten Flächen: Dichteformel aus verfügbaren Gebietsdaten oder Fallback-Formel

Deshalb darf die UI nicht suggerieren, dass Haushalte offiziell live verifiziert sind. Sie zeigt im Bestellflow:

- `Berechnet aus Gebietsdaten`
- `Datenbasis: berechnet aus verfügbaren Gebietsdaten`
- oder `Datenbasis: wird nach Prüfung bestätigt`

## Gebietsdaten v1

Die Modelle wurden so vorbereitet, dass echte Haushalts-/Geomarketing-/Postdaten später importiert werden können, ohne den Order-Wizard erneut umzubauen.

`DistributionArea` kann nun zusätzlich speichern:

- Gebietstypen: `POSTAL_CODE`, `CITY`, `DISTRICT`, `POLYGON`, `RADIUS`, `CUSTOM`, `DELIVERY_ZONE`
- `state`, `country`
- `geometryGeoJson`
- `areaKm2`
- `googlePlaceId`, `googleFeatureType`
- `dataSourceName`
- `dataSourceType`: `SEED`, `ADMIN`, `OFFICIAL`, `LICENSED`, `IMPORTED`, `ESTIMATED`
- `dataSourceUrl`
- `licenseNote`
- `dataUpdatedAt`
- `confidence`

`AreaHouseholdEstimate` kann nun zusätzlich speichern:

- `estimatedHouseholds`
- `estimatedResidents`
- `estimatedDwellings`
- `residentialBuildings`
- Methoden: `SEED`, `ADMIN_ENTRY`, `OFFICIAL_IMPORT`, `LICENSED_IMPORT`, `AREA_INTERPOLATION`, `BUILDING_ESTIMATE`
- `source`, `sourceUrl`, `sourceYear`
- `confidence`
- `notes`
- `validFrom`, `validTo`

Bestehende Felder bleiben erhalten, damit aktuelle Aufträge und der Order-Wizard stabil bleiben.

## Datenquellen je Startgebiet

### Koblenz

Aktuelle Datenquelle: Seed-/Admin-Gebietsbibliothek in `prisma/seed.mjs`, Tabelle `DistributionArea`.

Beispiele:

- `56068 Koblenz Zentrum`: `estimatedHouseholds = 6200`, `method = SEED`, `source = module8-seed`
- weitere Koblenz-Gebiete wie Metternich, Güls, Karthause und Polygone sind ebenfalls Seed-/Admin-Gebietsdaten

Confidence im UI/API-Kontext: `medium`, solange keine echte Importquelle hinterlegt ist.

### Neuwied

Aktuelle Datenquelle: Seed-/Admin-Gebietsbibliothek in `prisma/seed.mjs`, Tabelle `DistributionArea`.

Beispiele:

- `Neuwied Innenstadt`: `estimatedHouseholds = 4300`, `method = SEED`, `source = module8-seed`
- `Neuwied Radius 1.5km`: `estimatedHouseholds = 5200`, `method = SEED`, `source = module8-seed`

Confidence im UI/API-Kontext: `medium`, solange keine echte Importquelle hinterlegt ist.

### Bendorf

Aktuelle Datenquelle: Seed-/Admin-Gebietsbibliothek in `prisma/seed.mjs`, Tabelle `DistributionArea`.

Beispiel:

- `Bendorf Sayn`: `estimatedHouseholds = 1500`, `method = SEED`, `source = module8-seed`

Confidence im UI/API-Kontext: `medium`, solange keine echte Importquelle hinterlegt ist.

## Was ist echt?

- Gebietspolygone und Flächen kommen aus der vorhandenen Gebietsbibliothek, aus Admin-Pflege oder später aus Importen.
- Preise kommen aus den aktiven Pricing Rules und enthalten `pricingVersion = pricing-rule-v1`.
- Lagerzuordnung kommt aus der vorhandenen Warehouse-/Region-Logik.
- Routen-/Zeitwerte sind Berechnungen aus Fläche, Umfang, Haushaltsdichte, Distanz und Flyerzahl.

## Was ist Schätzung?

- `householdCount` ist aktuell eine Schätzung.
- Bei gespeicherten Gebieten basiert sie auf Seed-/Admin-Gebietsdaten.
- Bei manuell gezeichneten Flächen wird anhand der Gebietsdichte skaliert.
- Ohne passende Gebietsdaten wird eine Fallback-Dichteformel genutzt.

## UI-Confidence-Regel

Kundenansichten dürfen nur dann echte/exakte Haushalte suggerieren, wenn alle Bedingungen erfüllt sind:

- `dataSourceType = OFFICIAL` oder `dataSourceType = LICENSED`
- `AreaHouseholdEstimate.method = OFFICIAL_IMPORT` oder `LICENSED_IMPORT`
- `source` und `sourceYear` sind vorhanden
- `confidence` ist hoch genug

Sonst muss die UI eine vorsichtige Formulierung verwenden:

- `Haushalte geschätzt`
- `Datenbasis: verfügbare Gebietsdaten`
- `Datenbasis: wird nach Prüfung bestätigt`

## Calculation Snapshot

Der Bestellflow bereitet pro Gebietsberechnung einen Snapshot vor und übergibt ihn beim Auftrag an `priceRuleSnapshot.areaCalculationSnapshot`.

Enthalten sind:

- `source`
- `confidence`
- `calculatedAt`
- `calculationVersion`
- `householdCountSource`
- `pricingVersion`
- `areaReference`
- `polygonSource`
- `coverageAreaSqm`
- `householdCount`
- `recommendedFlyerQuantity`
- `pricePreview`
- `walkingDistanceKm`
- `deliveryDurationMinutes`
- `warehouseSuggestion`
- `distributorDemand`
- `deliverabilityScore`

## Importstruktur

Vorbereitet:

- Script: `scripts/import-distribution-areas.mjs`
- Template: `templates/distribution-areas-import-template.csv`
- Smoke-Test: `npm run test:area-data-import`

CSV-Felder:

- `postalCode`
- `city`
- `district`
- `name`
- `type`
- `geometryGeoJson`
- `estimatedHouseholds`
- `estimatedResidents`
- `estimatedDwellings`
- `residentialBuildings`
- `source`
- `sourceType`
- `sourceUrl`
- `sourceYear`
- `confidence`
- `licenseNote`
- `dataUpdatedAt`

Sicherheitsregel: Das Importskript validiert standardmäßig nur. Datenbank-Schreibungen passieren erst mit `--apply`.

Beispiel:

```bash
node -r dotenv/config scripts/import-distribution-areas.mjs templates/distribution-areas-import-template.csv
node -r dotenv/config scripts/import-distribution-areas.mjs echte-daten.csv --apply
```

## Mögliche spätere Datenquellen

- Deutsche Post Direkt / DATAFACTORY / microdialog
- Geomarketing-Anbieter wie microm, Acxiom, Nexiga, infas360
- OSM/Geofabrik für Geometrien, nicht automatisch für Haushaltszahlen
- Zensus/Regionaldatenbank, sofern Granularität und Nutzungsrechte passen
- amtliche Geodaten/Bundeslanddaten, sofern Lizenz und Aktualität passen

## Was fehlt für echte Haushaltsdaten?

Für launch-taugliche offizielle Haushaltszahlen wird benötigt:

- Lizenzvertrag und Nutzungsrechte für Web-App/Reports
- Importpipeline pro PLZ, Ortsteil, Straßenabschnitt oder Rasterzelle
- Quellen-/Stand-Datum je Datensatz
- Confidence- und Aktualitätslogik
- klare Kennzeichnung im Kundenbericht

## FLYERO Geo Engine und amtliche Grenzen

Die auswÃ¤hlbaren FlÃ¤chen kommen nicht aus Google Boundaries. Google Maps dient
nur als KartenoberflÃ¤che. FLYERO speichert importierte Verwaltungsgrenzen in
`DistributionArea.spatialGeometry` als PostGIS-Geometrie in EPSG:4326 und
ermittelt passende FlÃ¤chen serverseitig mit `ST_Intersects`.

FÃ¼r deutschlandweite Gemeindegrenzen ist `scripts/import-vg250-boundaries.mjs`
vorbereitet. Die VG250-Daten werden vor dem Import von EPSG:25832 nach EPSG:4326
transformiert und als amtliche Quelle gespeichert. Voraussetzung ist ein
installiertes `ogr2ogr`/GDAL. Der Import ist standardmÃ¤ÃŸig ein Dry-Run und
schreibt erst mit `--apply` in die Datenbank.

```bash
node scripts/import-vg250-boundaries.mjs /pfad/zu/DE_VG250.gpkg
node scripts/import-vg250-boundaries.mjs /pfad/zu/DE_VG250.gpkg --apply
```

VG250 liefert Verwaltungsgrenzen, aber keine Haushaltszahlen. GebÃ¤ude- und
Haushaltswerte dÃ¼rfen daher nicht aus der PolygonflÃ¤che erfunden werden. Die
GebietsflÃ¤che, Entfernung und der Preis werden nach einer Auswahl neu aus dem
aktuellen Gebietssnapshot berechnet; Haushalte bleiben je nach importierter
Quelle geschÃ¤tzt, bis offizielle oder lizenzierte Geomarketingdaten importiert
sind.
