# FLYERO Modul 27: Core Order Integrity

Stand: 14.07.2026  
Branch: `codex/module-27-core-order-integrity`

## Zweck

Dieses Dokument beschreibt den verbindlichen Daten- und Statusfluss vom
Planer bis zur Ausfuehrung. Es ist kein Marketingtext. Vorschauwerte aus dem
Browser gelten nicht als Auftragspreis oder Nachweis.

## Verbindliche Linie

1. Der Wizard sendet Gebiet, Teilgebiete, Flyerquelle, Druckdatenstatus und
   Zeitraum an den serverseitigen Planning-Quote-Service.
2. Der Server normalisiert Geometrie und Eingaben, berechnet Preis, Flaeche,
   Haushalte und Streckenwert neu und erstellt einen SHA-256-Fingerprint.
3. Der Order-Endpoint akzeptiert eine Bestellung nur, wenn der Fingerprint
   exakt zum aktuellen Server-Quote passt. Eine veraltete Quote endet mit
   HTTP 409 und `PLANNING_QUOTE_CHANGED`.
4. Der Order-Snapshot speichert Quote, Polygon-Hash, Teilgebiete, Quellen,
   Confidence, Version und Berechnungszeitpunkt. Ein spaeteres globales Gebiet
   darf einen bestehenden Auftrag nicht veraendern.
5. Checkout und Rechnung verwenden den serverseitig gespeicherten Bruttobetrag.
   Der Client kann keinen Preis oder Zahlungsbetrag autorisieren.

## Daten- und Quellenregeln

| Datenpunkt | Quelle im Kernprozess | Kunden-/Adminregel |
| --- | --- | --- |
| Flyerzahl | `Order.flyerQuantity` nach Quote-Pruefung | keine Clientzahl ohne Fingerprint |
| Netto/MwSt./Brutto | aktive Pricing-Konfiguration und `calculateOrderPrice` | Snapshot und Payment muessen identisch sein |
| Polygon/Flaeche | normalisierte GeoJSON-Teilgebiete | keine ungepruefte Clientflaeche |
| Haushalte | `DistributionArea`/`AreaHouseholdEstimate`, sonst Flaechenformel | immer Quelle und Schaetzung kennzeichnen |
| Laufstrecke | echte Providerantwort oder `polygon-estimate` | Formel bleibt als regionale Schaetzung sichtbar |
| GPS | externe Nachweisdatei oder echte Tourdaten | keine Fake-Route oder Fake-Heatmap |
| Distanz Disposition | Koordinaten-Haversine oder regionale Schaetzung | nie als exakte Strassenroute darstellen |

## Status- und Review-Flow

- `SUBMITTED` / `UNDER_REVIEW`: neue Anfrage wird intern geprueft.
- `WAITING_FOR_CUSTOMER`: Rueckfrage mit Pflichtnachricht; der Kunde bekommt
  eine verstaendliche Nachricht.
- unbezahlte Annahme: `PAYMENT_PENDING`; Zahlung bleibt der naechste Schritt.
- bezahlte Annahme: `APPROVED`; Rechnung und passende Fulfillment-Aktion
  werden idempotent gestartet.
- eigene Flyer: Lagerlieferung wird erwartet und im Kundenportal verfolgt.
- Druck durch FLYERO: Admin erhaelt eine explizite Druckprozess-Aufgabe; die
  operative Druckfreigabe bleibt ein bewusster Backoffice-Schritt.
- Ablehnung: Status, AuditLog und kundenfreundliche Begruendung werden
  gemeinsam geschrieben. Bei bereits bezahlten Auftraegen wird die Erstattung
  ueber den Stripe-/Refund-Pfad gestartet.

## Nachweise und Bericht

Berichte koennen erst nach Snapshot-Erzeugung geprueft werden. Externe GPS-
PDFs und manuelle Nachweise bleiben bis zur Datei- und Berichtfreigabe privat.
Veroeffentlichung akzeptiert ausschliesslich einen freigegebenen Bericht und
freigegebene Nachweise. Der Kunde sieht nur freigegebene Dateien und keine
Roh-IDs, internen Statuscodes oder internen Verteilerinformationen.

## Integritaetsdiagnose

Admin kann den nicht-sensiblen Check unter
`GET /api/admin/orders/[id]/integrity` ausfuehren. Er prueft:

- Quote gegen Auftrag und Polygon-Hash
- Zahlungsbetrag gegen serverseitigen Bruttobetrag
- Rechnung gegen Zahlung
- erwarteten Flyer-Versand gegen Fulfillment
- Warnungen fuer fehlende oder widerspruechliche Daten

Der Check ist diagnostisch. Er repariert keine Daten automatisch.

## Benachrichtigungen

Die Order-, Review-, Payment-, Rechnungs-, Lager- und Dispositionsereignisse
verwenden benannte Templates mit fachlichen Platzhaltern. Neue Modul-27-
Vorlagen liegen im Seed unter anderem fuer Anfrageeingang, Rueckfrage,
Zahlungsaufforderung, Annahme, Ablehnung, Rechnung, Lieferung und Disposition.
Der Versand laeuft weiterhin ueber die bestehende Notification-Queue.

## Tests

Neu bzw. erweitert:

- Quote-Konsistenz und veraltete Quote
- Order-Snapshot und gespeicherte-Gebiet-Editierung
- Metrik-Konsistenz und E2E-Vertrag
- Review, Fulfillment, Notifications und Benachrichtigungsvorlagen
- Admin-Ruecksprung bei Dispatch-Zuweisung
- Distanzquellen und Integritaetsdiagnose

Die ausfuehrbaren Modul-27-Checks stehen in `npm run test:module27`.
Der Runtime-Checkout-Smoke nutzt weiterhin den bestehenden lokalen Server und
keine Datenbankmigration oder Portaenderung.

## Bewusste Restpunkte

- Die serverseitige Routenberechnung ist fuer freie Gebiete weiterhin eine
  belastbare Schaetzung. Eine echte Google-Routes-Anfrage muss separat
  implementiert und erst dann als Providerergebnis bezeichnet werden.
- Druckservice-Auftraege erhalten aktuell eine Admin-Aufgabe; die vollstaendige
  Druckpartner-Automation bleibt ein eigener Backoffice-Schritt.
- Echte externe GPS-Berichte, Fotos und PDF-Berichte entstehen erst durch den
  operativen Nachweisprozess. Es werden keine Daten dafuer erfunden.
- Die Google-Maps-JavaScript-/Drawing-Funktion bleibt von korrekt gesetzten,
  domainbeschraenkten Browser-Keys abhaengig. Bei fehlender API darf nur ein
  klarer Fallback-/Pruefstatus erscheinen.
