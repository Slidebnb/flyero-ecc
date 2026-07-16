# FLYERO Leistungsangebot

## Online buchbar

Die folgenden Werbemittel verwenden den bestehenden Online-Auftragsweg. Der Auftraggeber wählt das Werbemittel, Gebiet, Menge, Empfangslager und Zeitraum. Die Auswahl wird in `Order.serviceType` und im Preis-Snapshot gespeichert.

- Flyer (`FLYER_DISTRIBUTION`)
- Türhänger (`DOOR_HANGER`)
- Prospekte & Broschüren (`BROCHURE`)
- Magazine (`MAGAZINE`)

Alle online buchbaren Materialien müssen vom Auftraggeber bereits gedruckt an das ausgewählte FLYERO-Lager gesendet werden. Ein Druckservice über FLYERO ist im Online-Flow nicht aktiv und wird ausschließlich separat über den Kontaktweg besprochen.

## Auf Anfrage

Warenproben/Sampling sowie Postkarten, Gutschein- und Einladungskarten sind sichtbar als Leistungen, werden aber noch nicht automatisch online bepreist. Für diese Angebote braucht FLYERO vor einer Direktzahlung eigene Mengen-, Material-, Personal- und Logistikregeln. Bis dahin führt der Button zu einer unverbindlichen Anfrage.

## Preisquelle

Die serverseitige `calculateOrderPrice`-Funktion bleibt die einzige Preisquelle. Wenn für einen neuen online buchbaren Service noch keine eigenen `PricingRule`-Zeilen gepflegt sind, verwendet der Dienst nachvollziehbar die aktive Flyer-Verteilungsstaffel als `pricingBasisServiceType`. Der angeforderte Service bleibt im Snapshot erhalten. So greifen Änderungen der aktiven FLYERO-Preisstaffel sofort auch für neue Buchungen, ohne eine zweite Preisformel im Frontend zu erzeugen.

Sobald ein Service eigene Regeln erhält, werden diese automatisch verwendet. Die Admin-Preisverwaltung kann damit später servicebezogene Staffeln ergänzen, ohne den Wizard umzubauen.

## Datenfluss

`serviceType` wird in der Auswahl gesetzt, in die Live-Quote und deren Fingerprint aufgenommen, serverseitig validiert, neu bepreist und in `Order.serviceType` sowie `priceRuleSnapshot` gespeichert. Dadurch kann eine alte Flyer-Quote nicht stillschweigend für einen Türhänger-Auftrag verwendet werden.
