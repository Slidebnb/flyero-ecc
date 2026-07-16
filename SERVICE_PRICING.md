# FLYERO Service-Pricing

## Leistungen

Die Online-Buchung unterstützt diese Leistungen mit eigenen Preisregeln:

| ServiceType | Kundenlabel | Mindestpreis netto |
| --- | --- | ---: |
| `FLYER_STANDARD` | Prospekte & Angebotsblätter | 599 EUR |
| `CATALOG_DISTRIBUTION` | Kataloge | 799 EUR |
| `BROCHURE_MAGAZINE` | Broschüren & Magazine | 699 EUR |
| `VOUCHER_CARD` | Gutscheinkarten | 599 EUR |
| `POSTCARD_INVITATION` | Postkarten & Einladungskarten | 649 EUR |
| `EVENT_INVITATION` | Veranstaltungseinladungen | 699 EUR |
| `COMMUNITY_PUBLICATION` | Vereins- & Gemeindeblätter | 699 EUR |
| `MENU_DELIVERY_CARD` | Speisekarten & Lieferkarten | 599 EUR |
| `PRODUCT_SAMPLING` | Produktproben & Sampling | 1.499 EUR |

Die bisherigen Enum-Werte bleiben für bestehende Aufträge erhalten. Die Legacy-Werte werden in der Oberfläche auf die neue Service-Struktur abgebildet und nicht umbenannt.

## Berechnung

Die Staffel wird marginal berechnet. Eine Regel speichert ihre Staffelbasis (`basePrice`) und nur die Stücke innerhalb dieser Staffel werden mit dem jeweiligen `pricePerUnit` berechnet. Dadurch steigt der Preis an jeder Schwelle mindestens um das nächste Stück und fällt niemals zurück.

Die Reihenfolge ist:

1. Service-Staffel berechnen.
2. Mindestpreis anwenden.
3. Gewichtsfaktor anwenden.
4. Gebietsfaktor anwenden.
5. Prozentuale und feste Zuschläge addieren.
6. MwSt. berechnen.
7. Brutto aus Netto und MwSt. berechnen.

Der Mindestpreis gilt damit für `NORMAL` und `LIGHT`; Gewicht und Gebiet erhöhen den Preis anschließend. Alle Werte sind netto gespeichert und werden im Snapshot zusammen mit MwSt. und Brutto festgehalten.

## Gewicht und manuelle Prüfung

| Klasse | Gewicht | Faktor |
| --- | ---: | ---: |
| `LIGHT` | bis 20 g | 1,00 |
| `STANDARD` | 21-50 g | 1,08 |
| `MEDIUM` | 51-100 g | 1,18 |
| `HEAVY` | 101-250 g | 1,35 |
| `CUSTOM` | über 250 g | keine automatische Buchung |

Die Klasse wird serverseitig aus dem Grammgewicht abgeleitet. Der Clientwert dient nur der Vorschau. `CUSTOM` blockiert den Direktcheckout und führt zu „Individuelles Angebot anfragen“.

## Gebiet und Zuschläge

Gebietsfaktoren: `NORMAL` 1,00, `MIXED` 1,15, `LOW_DENSITY` 1,25, `RURAL` 1,40 und `HARD` 1,60.

Die konfigurierbaren Zuschläge stehen in `PricingSetting`: Express unter sieben Tagen 20 %, Express unter 72 Stunden 35 %, Wochenende/Feiertag 25 %, weiteres getrenntes Gebiet 49 EUR, Abholung 49 EUR, Lagerung 29 EUR je Einheit und Sampling-Handling 0,15 EUR je Probe.

## Snapshot und Administration

Bei jedem Auftrag wird die Preisberechnung unveränderlich in `Order.priceRuleSnapshot` gespeichert. Enthalten sind unter anderem `pricingVersion`, `configurationVersion`, `serviceType`, `quantity`, Staffelgrenzen und -sätze, Mindestpreis, Gewicht, Gebiets- und Gewichtsfaktor, Zuschläge, `ruleIds`, Netto, MwSt., Brutto und `calculatedAt`.

Admin kann Regeln und Einstellungen unter `/admin/settings/pricing` pflegen. Änderungen werden auditiert und offene, noch nicht bezahlte Orders werden neu synchronisiert. Offene Stripe-Checkouts werden bei einer Preisänderung ungültig gemacht, damit Quote, Auftrag, Zahlung und Rechnung nicht auseinanderlaufen. Bezahlte Aufträge werden nicht rückwirkend verändert.

Die Migration `20260716110000_service_specific_pricing` ist additiv: bestehende Orders und Snapshots bleiben unverändert. Die Datenbankverbindung bleibt auf der bestehenden PostgreSQL-Konfiguration; die Migration ändert keinen Port.
