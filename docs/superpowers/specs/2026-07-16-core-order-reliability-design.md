# FLYERO Core Order Reliability Design

**Goal:** Preisfreigabe, Checkout-Sicherheit, deutschlandweite Gebietsplanung und Admin-Auftragsarbeit so verbinden, dass ein Kunde eine belastbare Bestellung abgeben kann und FLYERO sie ohne doppelte oder widerspruechliche Werte bearbeiten kann.

## Scope

Die Arbeit bleibt auf dem bestehenden FLYERO-Kernprozess. Es entstehen keine neuen Businessmodule, keine neuen Ports und kein neues Grunddesign. Bestehende Orders, Zahlungen, Pricing-Snapshots und Gebiets-Snapshots bleiben lesbar und unveraendert.

## Architecture

Der Server bleibt fuer Preis, Gebiet, Status und Zahlung verbindlich. Der Client zeigt nur eine Vorschau und sendet Eingaben. Preisregeln werden vor Aktivierung simuliert und versioniert; Checkout verwendet eine idempotente Order-/Session-Pruefung. Gebiete werden aus Google-Geocoding und aktivierten Boundary-Daten aufgebaut, ohne lokale Stadt-Fallbacks. Die Admin-Auftragsansicht aggregiert bestehende Order-, Payment-, Warehouse-, Document- und Report-Daten.

## Phases

1. **Pricing governance:** Admin kann eine Regel simulieren, Staffelgrenzen pruefen und eine neue Version auditierbar aktivieren.
2. **Checkout reliability:** doppelte Checkout-Aufrufe verwenden dieselbe offene Session oder werden sauber abgelehnt; Preis-Fingerprint und Zahlungsbetrag werden serverseitig erneut geprueft.
3. **Area selection:** PLZ, Ort und aktivierte Google-Boundaries werden deutschlandweit aufgeloest; alte Auswahlzustande werden bei Eingabeaenderung verworfen.
4. **Admin order workspace:** Die bestehende Admin-Auftragsseite priorisiert naechste Aktion, Zahlung, Druckdaten, Lager, Nachweise und Kommunikation in einer einheitlichen Reihenfolge.

## Acceptance Criteria

- Preisstaffeln koennen an keiner Grenze sinken.
- Eine Preisregel-Aenderung veraendert keinen bestehenden Pricing-Snapshot.
- Wiederholte Checkout-Requests erzeugen keine zweite Zahlung oder Stripe-Session.
- Ein Auftrag kann nur mit dem aktuell signierten Gebiet und Preis bezahlt werden.
- Eine freie PLZ-/Ort-Eingabe setzt keine erfundenen Ortsdaten.
- Eine geaenderte Suche uebernimmt kein altes Polygon, keine alte PLZ und keine alte Quote.
- Admin sieht bei jedem Auftrag die naechste fachliche Aktion.
- PostgreSQL bleibt auf `127.0.0.1:5432`.

## Verification

Jede Phase endet mit einem Regressionstest, `npm run lint`, `npx tsc --noEmit` und `npm run build`. Nach der Gesamtumsetzung laufen die vorhandenen Pricing-, Checkout-, Area-, Module-27- und Produktionsschutztests erneut.
