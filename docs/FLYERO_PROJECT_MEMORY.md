# FLYERO Project Memory

Dieses Dokument ist die kurze, verbindliche Projektgedaechtnisdatei fuer FLYERO. Es ersetzt keine fachlichen Detaildokumente, sondern beschreibt die Regeln, die bei jeder Aenderung erhalten bleiben muessen.

## Produktkern

FLYERO ist eine Plattform fuer professionelle Flyerverteilung mit:

- deutschlandweiter Gebietsplanung,
- serverseitiger Preis- und Auftragspruefung,
- Online-Zahlung oder unverbindlicher Anfrage,
- Kundenkonto, Rechnungen und Dokumenten,
- Lager- und operativer Auftragsabwicklung,
- externem GPS-Nachweis im MVP,
- Foto-Dokumentation und geprueftem Kundenbericht.

Der Kernprozess lautet:

```text
Gebiet planen -> Quote bestaetigen -> Auftrag speichern -> Zahlung pruefen
-> Rechnung -> Lager/Verteilung -> Nachweise pruefen -> Kundenbericht
```

## Verbindliche Architekturregeln

1. Preise, MwSt., Flyerzahl, Gebietsdaten, Lagerzuordnung, Status und Berechtigungen werden serverseitig validiert und neu berechnet.
2. Clientwerte, URL-Parameter, localStorage und Browserzustand sind Vorschau bzw. Eingabe, niemals die fachliche Wahrheit.
3. Planner, Kundenwizard, Auftrag, Stripe-Betrag und Rechnung muessen denselben serverseitigen Pricing-Snapshot verwenden.
4. Das bestaetigte Polygon wird als Auftragssnapshot gespeichert und darf spaeter nicht still aus einem neuen Clientzustand ersetzt werden.
5. Alle Datenabfragen und Mutationen pruefen Rolle, Kunde und Ressourcenbesitz serverseitig.
6. Externe Nebenwirkungen wie Stripe, E-Mail, Dateispeicher und Google Maps muessen Fehler, Wiederholung und Idempotenz kontrollieren.
7. Bestehende Migrationen werden nicht geloescht oder zurueckgesetzt. PostgreSQL bleibt auf `127.0.0.1:5432` in der lokalen Umgebung; Produktionscontainer verwenden ihre definierte Compose-Verbindung.

## Gebietsdaten

- Die Suche muss deutschlandweit funktionieren und darf nicht auf Koblenz, Bendorf, Neuwied oder andere fest eingebaute Orte begrenzt sein.
- Eine Autocomplete-Auswahl uebergibt und validiert `query`, `placeId`, `postalCode`, `city`, `lat`, `lng` und `source`.
- Bei freier Eingabe ohne bestaetigte Auswahl duerfen keine Ortsdaten erfunden werden.
- Aendert der Nutzer den Suchtext, werden alte Auswahl, placeId, Koordinaten, PLZ und Stadt sofort verworfen.
- Mehrere Teilgebiete muessen getrennt gespeichert, serverseitig aggregiert und im Snapshot nachvollziehbar bleiben.
- Haushalte und Flaechen sind nur dann exakt zu benennen, wenn die Datenquelle das nachweisbar traegt. Sonst muss die UI die Schaetzung und ihre Datenbasis nennen.

## Pricing und Checkout

- Alle Preise sind netto zzgl. MwSt.
- Staffelpreise werden marginal berechnet und duerfen an Grenzen nicht sinken.
- Der Mindestauftragswert gilt immer, sofern die aktive Preisregel nichts anderes festlegt.
- Preisregel, ServiceType, Menge, Faktoren, Zuschlaege, MwSt. und Version gehoeren in einen unveraenderlichen Pricing-Snapshot.
- Vor Checkout wird der aktuelle serverseitige Preis erneut geprueft. Ein veralteter oder manipulierter Preis blockiert den Vorgang und verlangt eine neue Bestaetigung.
- Eine bezahlte Bestellung darf der Kunde nicht loeschen. Unbezahlte bzw. fehlgeschlagene Entwuerfe duerfen kontrolliert entfernt werden.

## Nachweise im MVP

Im MVP zeichnet FLYERO GPS nicht selbst als verpflichtende native App auf. Der primaere Nachweis ist ein vom externen Tracking-System erzeugter GPS-Bericht, den der Admin zusammen mit Fotos und manuellen Ist-Werten hochlaedt, prueft und freigibt.

- Keine erfundenen GPS-Punkte, Fotos, Heatmaps oder Abdeckungswerte.
- Keine Aussage, dass jeder einzelne Briefkasten bestaetigt wurde.
- Kunden sehen nur freigegebene Nachweise und geschuetzte Downloads.
- Vorhandene Daten werden als geplant, tatsaechlich dokumentiert, geschaetzt oder geprueft unterschieden.

## Oeffentliche und Kunden-UI

- Das bestehende FLYERO-Design wird gezielt verfeinert, nicht durch parallele Grunddesigns ersetzt.
- Oeffentliche Seiten bleiben offen, editorial und frei von Card-Grid- bzw. Rastermuster-Ueberladung.
- Kundentexte sind handlungsorientiert und frei von Entwicklerbegriffen, Roh-IDs, Stacktraces und internen Statusnamen.
- Keine sichtbaren Demo-, Mock-, Seed- oder Testdaten in echten Kundenablaeufen.
- Ein leeres Nachweisgebiet bleibt ehrlich: Nachweise erscheinen erst nach echter Durchfuehrung und Freigabe.

## Betrieb und Verifikation

- Vor einem Release muessen relevante Lint-, Build-, Prisma- und Fachtests ausgefuehrt werden.
- UI-Aenderungen benoetigen echte Browser-Screenshots in 1440px und 390px sowie eine sichtbare Pruefung.
- Ein Screenshot- oder Test-Timeout ist ein offenes Problem und darf nicht als Erfolg gemeldet werden.
- Produktionsaenderungen werden erst nach verifiziertem Build, Migrationstatus, Healthcheck und Rollback-/Backup-Betrachtung ausgerollt.
- Secrets bleiben ausserhalb von Git und Client-Bundles.

## Bereits behobene Fehlerbilder

- Fake-Proof-Grafiken, Fake-Pins und Beispieltexte gehoeren nicht ins Kundenportal.
- Customer-Labels mappen `WAITING_INTERNAL` auf `In Pruefung` und `REJECTED` auf `Geschlossen`.
- Bei leerem Gebiet steht `Gebiet auswaehlen`, waehrend der Berechnung `Preis wird aktualisiert` und bei manueller Pruefung `Preis wird von FLYERO geprueft`.
- Autocomplete, Geocode und Quote haben getrennte Rate-Limit-Bereiche.
- Fehlende Service-PricingRules duerfen nicht still auf eine Flyer-Regel zurueckfallen.
- Checkout benoetigt den aktuellen serverseitigen Preis-Fingerprint.
