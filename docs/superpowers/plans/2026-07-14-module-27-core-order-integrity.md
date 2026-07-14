# Modul 27 P0: Core Order Integrity

Stand der Analyse: 14.07.2026
Start-Commit: `13657ef Mehrgebiete und deutschlandweite Verteilung vorbereiten`
Start-Branch: `codex/module-27-core-order-integrity`
Basisvergleich: `origin/main` ist auf demselben Commit wie der Start-HEAD.
Der Arbeitsbaum enthielt bereits uncommittete Aktivierungs-/Checkout-Aenderungen
aus dem vorherigen Modul-27-Arbeitsstand. Diese Aenderungen werden erhalten und
nicht zurueckgesetzt.

## Arbeitsregeln

- Keine Migration loeschen, kein Reset, kein Portwechsel.
- Planner, API, Order, Payment, Invoice und Admin muessen dieselbe verbindliche
  Planung bzw. denselben Preis-Snapshot verwenden.
- Clientwerte sind Vorschau-/Eingabedaten. Fachdaten werden serverseitig
  normalisiert, berechnet und vor Order-Erstellung erneut validiert.
- Kein Google-, Haushalts-, Routing- oder GPS-Wert darf als echt erscheinen,
  wenn nur eine Formel oder ein lokaler Fallback verwendet wurde.

## Vollstaendige Data-Lineage-Matrix vor Implementierung

| Wert | Ursprung | Client-Anzeige | API-Eingabe | Servervalidierung | Datenbankfeld | Adminanzeige | Kundenanzeige | Stripe/Rechnung |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flyerzahl | `SmartOrderWizard` und optional Segmentmengen | Wizard-Menge und Quote | `flyerQuantity`, `areaSegments` | Integer, Grenzen, Gesamtmenge; Quote-Fingerprint | `Order.flyerQuantity`, Segment `flyerQuantity`, Price Snapshot | Order-Cockpit, Lager, Tour | Kampagnen-/Berichtsmengen | Payment amount basiert auf serverseitigem Brutto; Invoice items |
| Nettopreis | `calculateOrderPrice` aus PricingRule/PricingSetting | Quote netto | nie vertrauenswuerdig; Quote-Fingerprint | serverseitig neu berechnet, Manual Override getrennt | `Order.calculatedNetPrice`, `manualPriceOverride`, `priceRuleSnapshot` | Auftrag/Preispruefung | Kundenauftrag | Invoice subtotal; Stripe metadata/amount basis |
| MwSt. | `getVatRate` / Price Calculation | Quote MwSt. | nicht vom Client uebernommen | serverseitig aus SystemSettings | `Order.calculatedVat`, Invoice `vatAmount` | Preispruefung | Netto/MwSt./Brutto | Invoice total calculation |
| Bruttopreis | Netto plus serverseitige MwSt. | Quote brutto | nicht vom Client uebernommen | serverseitig, Amount-Invariante | `Order.calculatedGrossPrice`, Payment amount | Auftrag/Payment | Auftrag/Checkout | Stripe Checkout amount, Invoice `totalGross` |
| Polygon | Map drawing / saved area / segment draft | Map und Summary | `targetAreaGeoJson`, `areaSegments` | normalize, geschlossener Ring, Grenzen, Hash | `Order.targetAreaGeoJson`, Segment `geometryGeoJson`, area reference | Order map | Order/campaign map | nicht direkt |
| Flaeche | Client preview only | Map summary | `coverageAreaSqm` nur Hinweis | aus normalisiertem GeoJSON neu berechnet | `Order.coverageAreaSqm`, segment `areaSqm`, snapshot | Order-cockpit | Campaign metrics | Preis nur mengenbasiert |
| Haushalte | AreaHouseholdEstimate/DistributionArea, sonst Flaechenformel | Quote mit Quelle/Confidence | optional nur als Vorschau | serverseitige Quelle-/Methodenentscheidung | `Order.estimatedHouseholds`, segment estimate, snapshot | Quelle/Confidence | geschaetzt/bestaetigt mit Quelle | nicht direkt |
| Strecke | echte Routing-Antwort oder Geometrieformel | Quote mit Providerlabel | optional `distanceMeters`/perimeter | keine falsche Providerbezeichnung; versionierte Quelle | `Order.estimatedDistanceMeters`, snapshot | Quelle/Confidence | geschaetzt oder unavailable | nicht direkt |
| Zeitraum | Wizard Eingabe | Zeitraum-Schritt | start/end/flexible | Datum/7-Tage-Regel und Format | `Order.preferredStartDate`, `preferredEndDate` | Pruefcockpit | Kampagnenstatus | Mail/Invoice Kontext |
| Flyerquelle | Wizard Auswahl | Flyer/Druck-Schritt | `flyerSource`, `printDataStatus` | Enum und Branching | `Order.customerOwnFlyers`, `needsPrintService`, snapshot | Druck-/Lagerstatus | naechster Schritt | Fulfillment, keine Preisformel |
| Lager | WarehouseRegion/Logistics match | Quote nur als Status | nicht vom Client vertrauenswuerdig | Order-Snapshot PLZ/Stadt/Mittelpunkt; idempotente Zuordnung | `Order.assignedWarehouseId`, segment warehouse | Lager/Kapazitaet | Liefer-/Abholhinweis | Kundenmail |

## Gefundene Ursprungs- und Transformationsstellen

1. `SmartOrderWizard.tsx` berechnet lokale Haushalte, Strecke und Dauer und
   zeigt parallel ein `intelligence`-Ergebnis. Das Ergebnis wird bei einer
   neuen Anfrage nicht sofort invalidiert; dadurch kann eine alte Quote sichtbar
   bleiben, waehrend neue Eingaben bereits abgesendet werden.
2. `src/app/api/maps/order-intelligence/route.ts` und
   `src/app/api/public/planner/quote/route.ts` rufen `getOrderIntelligence` auf.
   `smartMaps.ts` berechnet Haushalte/Route/Preis, nutzt aber clientnahe
   Vorschauparameter und einen Default-Dichtewert.
3. `src/app/api/customer/orders/route.ts` normalisiert Mehrgebiete und erstellt
   Order-Segmente, muss aber eine verbindliche Quote/Fingerprint pruefen und die
   Orderdaten gegen die serverseitige Berechnung festschreiben.
4. `src/lib/areas.ts:assignAreaToOrder` schreibt aktuell Stadt, PLZ, Polygon,
   Haushalte, Flyer, Strecke und Flaeche aus einer globalen Vorlage in die
   Order. Das kann kundenspezifische Aenderungen nachtraeglich ueberschreiben.
5. `src/lib/routing.ts` bzw. `smartMaps.ts` verwenden fuer freie Gebiete eine
   Formel/Haversine-Schaetzung. Die Quelle muss als `polygon-estimate` oder
   `haversine-estimate` erscheinen, nicht als Google-Route.
6. `src/lib/pricing.ts` ist die Preisquelle. Checkout und Invoice muessen die
   gespeicherten Orderwerte bzw. einen dokumentierten Manual Override verwenden.
7. Admin-Pruefung, Statuswechsel, Invoice, Warehouse/Shipment, Dispatch und
   Notifications liegen in getrennten Routen/Services und brauchen einen
   idempotenten Review-Orchestrator.

## API- und Google-Inventar

| Funktion | Aktuelle Implementierung | Dienst | Ausfuehrung | Fallback | Kosten/Limit |
| --- | --- | --- | --- | --- | --- |
| Autocomplete | `smartMaps.ts` `googleAutocomplete` | Places Autocomplete | Server | keine oeffentliche lokale Dummy-Liste | Rate Limit |
| Geocoding | `smartMaps.ts` `googleGeocode` | Geocoding API | Server | nur als geschaetzt markieren | Rate Limit |
| Kartenanzeige | `SmartOrderWizard` | Maps JavaScript API | Client | neutrale Karten-/Fehleranzeige | Browser-Key |
| Polygonbearbeitung | Maps Drawing Library | Drawing/Geometry | Client | normalisierte Geometrie serverseitig | API-Deprecation pruefen |
| Routenberechnung | `estimateRouteDistanceMeters` | aktuell kein echter Google-Routes-Call | Server/Formel | `polygon-estimate` | keine Providerkosten |
| Distanzmatrix | keine verbindliche Nutzung im Kernflow | Routes Matrix optional | spaeter/gezielt | unavailable | nicht pauschal aufrufen |
| Adressvalidierung | Geocode-Komponenten | Geocoding | Server | unvollstaendig -> manuelle Pruefung | Rate Limit |

## Umsetzungsstand

- [x] Quote-Contract, Fingerprint und stale-submit-409
- [x] Serverberechnung fuer Order und gespeicherten Bereich
- [x] Referenzverknuepfung ohne Snapshot-Ueberschreibung
- [x] Quellen, Confidence, Version und Berechnungszeitpunkt im Quote
- [x] Lager-/Teilgebiets-Match und manuelle Pruefung ausserhalb aktiver Regionen
- [x] Review-Orchestrator fuer Annahme, Rueckfrage, Ablehnung und Fulfillment
- [x] Dispatch-Ruecksprung und Distanzquellenkennzeichnung
- [x] Benachrichtigungsvorlagen und Integritaetsdiagnose
- [x] Regression-Smokes fuer die neuen P0-Vertraege

## Umsetzungsschritte

1. Quote-Contract und Fingerprint fuer alle preis-/planungsrelevanten Eingaben
   zentral implementieren; alte Quote im Client sofort veralten lassen; stale
   Submit mit HTTP 409 blockieren.
2. Server normalisiert Polygon/Segmente, berechnet Flaeche und Kennzahlen neu
   und schreibt den unveraenderlichen Order-Snapshot.
3. `assignAreaToOrder` in reine Referenzverknuepfung und explizite Snapshot-
   Kopie trennen; Standard-Zuweisung darf keine kundenspezifische Order
   ueberschreiben.
4. Haushalts-/Routing-Quellen, Confidence, Version und Zeitpunkt in Quote und
   Snapshot sichtbar machen; lokale Werte nicht als live ausgeben.
5. Lager anhand des Order-Snapshots bestimmen und idempotent reservieren.
6. Explizite Order-Review-State-Machine und zentralen Orchestrator fuer
   Annahme, Rueckfrage, Ablehnung, Payment, Invoice, Print/Shipment und
   Notifications einfuehren.
7. Admin-Ruecksprung bei Dispatch-Zuweisung absichern und echte/geschaetzte
   Distanzquellen ausweisen.
8. Regression-Smokes fuer Quote, Snapshot, Review, Fulfillment, Dispatch,
   E-Mail und den vollstaendigen Kernprozess ergaenzen.
9. Vollstaendige bestehende Regression, Browser-E2E und Datenbank-/Queue-
   Invarianten ausfuehren; erst danach committen und pushen.

## Abnahmekriterien

- Eine Quote ist nur fuer ihren Fingerprint aktuell.
- Eine Order entsteht nur mit serverseitig bestaetigter Quote.
- Planner, Order, Payment und Invoice haben dieselben Netto-/MwSt.-/Bruttowerte.
- Order-Karte und Admin-Karte verwenden den Order-Snapshot.
- Global gespeicherte Gebiete koennen historische Orders nicht veraendern.
- Haushalte und Strecke zeigen Quelle, Methode, Version und Confidence.
- Anfrage, Annahme, Rueckfrage, Ablehnung und Fulfillment sind historisiert,
  idempotent und kundenseitig verstaendlich.
