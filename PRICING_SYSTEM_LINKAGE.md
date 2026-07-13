# Preis-System-Verknuepfung

## Aktuelle Quelle

Die aktiven Datensaetze in `PricingRule` und `PricingSetting` sind die einzige
laufende Quelle fuer Flyerpreise und MwSt. Die zentrale Berechnung liegt in
`src/lib/pricing.ts`.

## Was bei einer Admin-Aenderung passiert

1. Admin speichert Preisregeln oder MwSt. ueber die Settings-Seite oder die
   Admin-API.
2. Die Eingabe wird auf Staffel-Luecken, Ueberschneidungen und fallende Preise
   geprueft.
3. Offene Orders ohne bezahlte Zahlung werden mit der aktuellen Konfiguration
   neu berechnet.
4. Offene Checkout-Zahlungen werden storniert und ein alter externer Checkout
   wird, sofern moeglich, beendet.
5. Orderpreis, MwSt., Regel-Signatur und der verschachtelte Gebiets-Snapshot
   werden gemeinsam aktualisiert.
6. Der Kunde bekommt eine In-App-Benachrichtigung. Kundenansichten und die
   oeffentliche Preisseite werden invalidiert.

## Geschuetzte Preise

Bezahlte, erstattete und manuell festgelegte Preise werden nicht durch eine
allgemeine Preisregel-Aenderung ueberschrieben. Rechnungen verwenden den zum
Auftrag gespeicherten Snapshot, damit historische Rechnungen unveraendert
bleiben.

## Neue Verteilung und Checkout

- Neue Orders berechnen den Preis serverseitig aus der aktuellen Konfiguration.
- Die Karten-/Gebietskalkulation verwendet dieselbe Berechnung.
- Beim Checkout wird der Preis nochmals serverseitig neu berechnet.
- Der Checkout-Snapshot aktualisiert auch die Preisreferenz im
  `areaCalculationSnapshot`.
- Eine neue Rechnung basiert auf dem gespeicherten Order-Snapshot.

## Tests

Der Ablauf wird durch folgende Checks abgesichert:

- `npm run test:pricing-system-linkage`
- `npm run test:pricing-admin-propagation`
- `npm run test:customer-order-area`
- `npm run test:customer-order-checkout`

