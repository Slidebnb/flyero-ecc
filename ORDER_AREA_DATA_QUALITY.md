# FLYERO Order Area Data Quality

Stand: 2026-07-10

## Kurzfazit

Die Haushaltszahlen im Kunden-Bestellflow sind aktuell keine amtlichen oder lizenzierten Post-/Geomarketing-Haushaltsdaten. Sie werden aus vorhandenen FLYERO-Gebietsdaten berechnet.

Die aktuelle Quelle ist:

- `DistributionArea.estimatedHouseholds`
- optional zugehörige `AreaHouseholdEstimate`-Einträge
- bei Demo-/Seed-Daten: `AreaHouseholdEstimate.method = SEED`, `source = module8-seed`
- bei frei gezeichneten Flächen: Dichteformel aus verfügbaren Gebietsdaten oder Fallback-Formel

Deshalb darf die UI nicht suggerieren, dass Haushalte offiziell live verifiziert sind. Sie zeigt im Bestellflow:

- `Berechnet aus Gebietsdaten`
- `Datenbasis: berechnet aus verfügbaren Gebietsdaten`
- oder `Datenbasis: wird nach Prüfung bestätigt`

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

- Gebietspolygone und Flächen kommen aus der vorhandenen Gebietsbibliothek oder aus dem vom Kunden gezeichneten Polygon.
- Preise kommen aus den aktiven Pricing Rules und enthalten `pricingVersion = pricing-rule-v1`.
- Lagerzuordnung kommt aus der vorhandenen Warehouse-/Region-Logik.
- Routen-/Zeitwerte sind Berechnungen aus Fläche, Umfang, Haushaltsdichte, Distanz und Flyerzahl.

## Was ist Schätzung?

- `householdCount` ist aktuell eine Schätzung.
- Bei gespeicherten Gebieten basiert sie auf Seed-/Admin-Gebietsdaten.
- Bei manuell gezeichneten Flächen wird anhand der Gebietsdichte skaliert.
- Ohne passende Gebietsdaten wird eine Fallback-Dichteformel genutzt.

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

## Was fehlt für echte Haushaltsdaten?

Für launch-taugliche offizielle Haushaltszahlen wird eine lizenzierte Datenquelle benötigt, z. B.:

- Post Direkt / Deutsche Post Direkt Geomarketing
- microm / Acxiom / Nexiga / infas360 oder vergleichbare Geomarketing-Daten
- amtliche Statistik nur, wenn Nutzungsrechte und räumliche Granularität passen

Benötigt werden:

- Lizenzvertrag und Nutzungsrechte für Web-App/Reports
- Importpipeline pro PLZ, Ortsteil, Straßenabschnitt oder Rasterzelle
- Quellen-/Stand-Datum je Datensatz
- Confidence- und Aktualitätslogik
- klare Kennzeichnung im Kundenbericht
