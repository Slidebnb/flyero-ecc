# Meine-Heimat-Statistik

FLYERO kann amtliche Statistikwerte aus der [Meine-Heimat-API](https://meine-heimat-statistik.de/api/docs/) als versionierte Gebietsschaetzung importieren. Der Dienst wird bewusst nur ueber einen kontrollierten Synchronisationslauf verwendet. Der oeffentliche Planer ruft die Statistik-API nicht bei jeder Eingabe auf.

## Voraussetzungen

Die API-Dokumentation beschreibt `POST /api/v1/export` mit Basic Auth. Der Export benoetigt:

- einen 12-stelligen ARS-Regionsschluessel,
- einen bestaetigten `Lfdnr`-/Merkmalschluessel,
- ein Statistikjahr,
- `outputFormat: CSV`.

Ein Ortsname, eine PLZ oder ein achtstelliger AGS wird nicht automatisch in einen ARS umgewandelt. Das verhindert, dass ein Wert dem falschen Gebiet zugeordnet wird. Nur importierte amtliche Gebiete mit `officialRegionCode` duerfen synchronisiert werden.

## Umgebungsvariablen

In `.env.production` werden die Zugangsdaten nur auf dem Server gesetzt:

```text
MEINE_HEIMAT_API_BASE_URL="https://meine-heimat-statistik.de/api"
MEINE_HEIMAT_API_USERNAME=""
MEINE_HEIMAT_API_PASSWORD=""
MEINE_HEIMAT_HOUSEHOLD_LFDNR=""
MEINE_HEIMAT_VALUE_COLUMN=""
MEINE_HEIMAT_STATISTICS_YEAR="2026"
MEINE_HEIMAT_API_TIMEOUT_MS="8000"
```

`MEINE_HEIMAT_HOUSEHOLD_LFDNR` muss aus dem Statistikangebot des Providers stammen. Er darf nicht geraten werden. Falls der Export eine nicht standardisierte Wertespalte liefert, kann deren Spaltenname in `MEINE_HEIMAT_VALUE_COLUMN` gesetzt werden.

## Synchronisation

Zuerst nur pruefen:

```bash
node --experimental-strip-types -r dotenv/config scripts/sync-meine-heimat-statistics.mjs
```

Erst nach der fachlichen Kontrolle des Exports anwenden:

```bash
node --experimental-strip-types -r dotenv/config scripts/sync-meine-heimat-statistics.mjs --apply
```

Der Lauf ist fail-closed: Fehlt fuer ein Gebiet ein eindeutiger Wert, wird kein Teil der Gruppe geschrieben. Jeder Wert wird als `AreaHouseholdEstimate` mit Quelle, Jahr, Methode und Confidence gespeichert. Bestehende Auftraege und deren Snapshots werden nicht veraendert.

## Bewusste Grenzen

Die API ist eine Statistikquelle fuer die dort verfuegbaren Regionen. Sie ersetzt weder die amtlichen Gebietsgeometrien noch eine deutschlandweite Haushaltsdatenbank. Ohne ARS-Zuordnung, Zugangsdaten und bestaetigten Haushalts-Merkmalschluessel zeigt FLYERO weiterhin keine automatische Flyerempfehlung an. Das ist fachlich korrekt und verhindert erfundene Haushaltszahlen.

Die lokale Datei `gesamtstatistik_30062026.csv` wird nicht als Haushaltsquelle verwendet: Sie enthaelt Gemeinde-/Einwohnerstatistik, aber keinen belastbaren gebietsbezogenen Haushaltswert fuer den Planner.
