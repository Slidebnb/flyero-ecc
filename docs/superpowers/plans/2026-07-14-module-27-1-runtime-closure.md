# FLYERO Modul 27.1 - P0 Runtime Closure

## Ausgangslage

Start-Commit: `fb38ac753b07bd7a4e4ffb3abf13d3d3f77fb019`
Branch vor Arbeitsbeginn: `codex/module-27-core-order-integrity`
Arbeitsbranch: `codex/module-27-1-runtime-closure`
Origin-Main beim Start: `fb38ac753b07bd7a4e4ffb3abf13d3d3f77fb019`

Der Arbeitsbaum war vor diesem Modul bereits durch die laufende PLZ-/Gebietssuche und Kundenloeschung veraendert. Diese Aenderungen werden nicht verworfen, sondern als bestehender Arbeitsstand mitgeprueft.

## Befundmatrix

| Bereich | Aktueller Zustand | Fehler | Root Cause | Geplanter Fix | Runtime-Test |
| --- | --- | --- | --- | --- | --- |
| Preis-Anzeige | Order und Admin verwenden `getOrderGrossPrice` | Brutto wird als allgemeiner Preis bezeichnet | UI nutzt nur den effektiven Bruttowert | gemeinsame Netto/MwSt./Brutto-Darstellung aus Orderfeldern und Override-Hinweis | Preis- und Seiten-Assertion |
| Kundenkarte | `targetAreaGeoJson` ist vorhanden, Detailseite nutzt teilweise die Relation zuerst | gespeichertes Gebiet kann vom Auftragssnapshot abweichen | falsche Fallback-Reihenfolge | Snapshot zuerst, Relation nur fuer historische Auftraege ohne Snapshot | Snapshot-Runtime |
| Kundenkorrektur | PUT schreibt neue Quote, Relation und Segmente in mehreren Schritten | alte Relation/Segmente/Paymentlink koennen bleiben | keine atomare Ersatz-Transaktion und zu freier Status | bezahlte Orders sperren; unbezahlte Korrektur atomar ersetzen und `UNDER_REVIEW` setzen | Korrektur-Runtime |
| Adminannahme | `reviewOrder` setzt unbezahlt auf `PAYMENT_PENDING` | Anfrage wird nach Zahlung erneut voll geprueft | kein fachlicher Status fuer angenommene Anfrage | `ACCEPTED_AWAITING_PAYMENT` plus idempotente Zahlungspromotion | Review-Payment-Runtime |
| Review | Statusroute und `orderReviewWorkflow` enthalten Reviewentscheidungen | doppelte Geschaeftslogik und alter Refundpfad | generische Statusroute ist zu maechtig | dedizierter Review-Service/-Endpoint; Statusroute delegiert kompatibel | Review-/Refund-Runtime |
| Flyerquelle | Fulfillment-Services sind vorhanden | Kundentext kann Druckkunden zur Eigenanlieferung auffordern | statischer Admin-Placeholder und nicht quellenspezifische Nachricht | Nachricht und UI aus `customerOwnFlyers`/`needsPrintService` ableiten | Fulfillment-Runtime |
| E-Mail | Queue und Worker existieren | Zustellung und Idempotenz sind nicht als Runtime nachgewiesen | CI startet keinen echten Worker-Test verbindlich | isolierter Queue-Worker-Runtime-Test und CI-Step | Notification-Runtime |
| Mehrgebietsdispatch | `segmentId` existiert in Assignment/Tour | Kapazitaet und Zuweisungsersatz koennen auf Orderebene wirken | einzelne Pfade setzen globale Order-/Inventory-Felder | Segmentmenge und aktive Assignment-Scope zentral pruefen | Multi-area-Runtime |
| Bestandsdaten | Integrity-Service ist diagnostisch vorhanden | Inkonsistenzen blockieren kritische Aktionen nicht systematisch | Checks nicht an Prozessgrenzen verdrahtet | kontextbezogene Integrity-Gates vor Review, Zahlung, Fulfillment und Dispatch | Integritaets-Runtime |
| CI | viele Contract-Smokes, Modul 27 nicht in CI | Textpruefung wird als Prozessnachweis missverstanden | kein gemeinsamer runtime script | echte PostgreSQL-/API-Tests als CI-Step, Contract-Smokes bleiben ergaenzend | CI-Lauf |

## Verbindliche State Machine

### Anfrage

`SUBMITTED -> UNDER_REVIEW -> WAITING_FOR_CUSTOMER -> UNDER_REVIEW -> ACCEPTED_AWAITING_PAYMENT -> APPROVED`

Bei Zahlungsfehler bleibt eine angenommene Anfrage in `ACCEPTED_AWAITING_PAYMENT` und kann erneut bezahlt werden. Eine direkte Onlinebuchung bleibt `PAYMENT_PENDING -> PAID_WAITING_FOR_ADMIN_REVIEW -> APPROVED`.

### Reviewaktionen

`approve`, `clarification` und `reject` werden nur im zentralen Review-Service ausgefuehrt. Die generische Statusroute darf nur noch kompatibel an diesen Service delegieren, solange alte Formulare existieren.

### Korrekturen

Unbezahlte preis- oder gebietsrelevante Korrektur: neue serverseitige Quote, Snapshot/Segmente/Relation in einer Transaktion ersetzen, offene Zahlungsanforderung invalidieren, `UNDER_REVIEW`, Adminbenachrichtigung und AuditLog.

Bezahlte preis- oder gebietsrelevante Korrektur: HTTP 409 mit `PAID_ORDER_REQUIRES_ADMIN_CHANGE`; keine stillen Datenmutationen.

## Datenquellen und Invarianten

- Preis: `calculateOrderPrice`/`PricingService` und gespeicherter Price-Snapshot. UI, Stripe und Invoice muessen dieselben Orderfelder verwenden.
- Gebiet: `Order.targetAreaGeoJson`, `coverageAreaSqm`, `estimatedHouseholds`, `estimatedDistanceMeters` und `priceRuleSnapshot.areaCalculationSnapshot`. `DistributionArea` ist nur Referenz oder Altauftrags-Fallback.
- Segmente: `OrderDistributionSegment` ist die operative Teilgebietsquelle; jede segmentbezogene Zuweisung nutzt `segmentId` und `segment.flyerQuantity`.
- Zahlung: Payment-Service und Stripe/Webhook; ein bezahlter Betrag darf nicht aus Clientdaten abgeleitet werden.
- Fulfillment: eigene Flyer erzeugen Kundenshipment; Druckservice erzeugt PrintOrder, aber keine Eigenanlieferungsanweisung.
- E-Mail: `NotificationQueue` plus `notificationWorker`; Status `SENT` ist erst nach Provider-Aufruf erlaubt.

## Migrationsstrategie

Nur additive Migrationen, falls die vorhandene Struktur nicht reicht:

1. `ACCEPTED_AWAITING_PAYMENT` im `OrderStatus` und alle Label-/Transitionsstellen.
2. Review-Snapshot-Metadaten nur falls vorhandene Order-/Audit-Felder nicht ausreichen.
3. Eindeutige Idempotenz-/Retry-Felder nur falls der bestehende Queue-/Payment-Schluessel nicht reicht.

Bestehende Migrationen werden nicht geloescht oder veraendert. Vor Migration gegen leere und bestehende Datenbank laufen `prisma validate`, `prisma generate` und `prisma migrate deploy`.

## Runtime-Teststrategie

Die neuen Tests arbeiten gegen eine isolierte PostgreSQL-Datenbank und einen laufenden Next-Server. Sie pruefen HTTP-Antworten, Prisma-Zustaende, Payments, Queue-Verarbeitung und Idempotenz. Contract-Smokes bleiben als Architekturpruefung erhalten, werden aber nicht als End-to-End-Nachweis bezeichnet.

Geplante Runtime-Skripte:

- `order-pricing-runtime.mjs`
- `order-area-snapshot-runtime.mjs`
- `order-correction-runtime.mjs`
- `order-review-payment-runtime.mjs`
- `order-paid-rejection-runtime.mjs`
- `order-fulfillment-runtime.mjs`
- `notification-delivery-runtime.mjs`
- `multi-area-dispatch-runtime.mjs`
- `order-integrity-repair-runtime.mjs`
- `module27-1-runtime.mjs`

Falls lokale Voraussetzungen fuer einen Test fehlen, wird er explizit als blockiert dokumentiert und nicht durch eine schwache Assertion ersetzt.

## Bestandsaudit und Reparatur

`audit-order-integrity.mjs` bleibt lesend und meldet Quote-, Preis-, Polygon-, Segment-, Payment-, Invoice- und Fulfillment-Abweichungen ohne unnötige personenbezogene Daten. Ein optionales Repair-Script arbeitet standardmaessig mit `--dry-run`; automatische Reparatur erfolgt nur bei eindeutigem Snapshot-Hash-Match. Unklare Daten werden nicht geraten oder ueberschrieben.

## Rollback-Strategie

- Vor Migration und Deployment: Datenbankbackup und Git-Commit sichern.
- Neue Statuswerte werden nur additive eingefuehrt; alte Status bleiben lesbar.
- Review-Service wird zuerst kompatibel erweitert, dann routenweise umgestellt.
- CI prueft alte Contract-Smokes und neue Runtime-Suites gemeinsam.
- Bei Fehlern kann der neue Endpoint deaktiviert werden, waehrend die kompatible Route auf den alten Service delegiert; Datenbankmigrationen werden nicht rueckgerollt, sondern vorwaerts korrigiert.
- Repair-Script schreibt nur mit explizitem `--apply`.

## Bestehende Datenrisiken

- Historische Orders ohne `targetAreaGeoJson` brauchen den Relation-Fallback.
- Bereits inkonsistente Segmente duerfen nicht automatisch geraten werden.
- Zahlungs- und Refundstatus muessen mit Stripe-/Mock-Ereignissen abgeglichen werden.
- E-Mail-Provider `mock` beweist Queue-Verarbeitung, aber keine externe SMTP-/Resend-Zustellung.
- Externe Google-Geometrien und echte Haushaltsdaten sind ausserhalb dieses Moduls keine automatisch garantierte Quelle.

## Umsetzungsreihenfolge

1. Regressionstests fuer Preislabels, Snapshotprioritaet, Korrektursperre und Adminannahme.
2. Gemeinsame UI-/Datenquelle fuer Netto, MwSt. und Brutto.
3. Snapshotprioritaet in Kunden-, Admin- und Reportpfaden.
4. Atomare Kundenkorrektur und bezahlte Order-Sperre.
5. `ACCEPTED_AWAITING_PAYMENT` und idempotente Payment-Promotion.
6. Review-/Refund-Konsolidierung.
7. Flyerquellen-spezifisches Fulfillment.
8. Notification-Worker-Runtime und CI.
9. Segmentbezogene Dispatch-Korrekturen.
10. Audit-/Repair-Script und Playwright-Pruefung.

## Abschlussstand 2026-07-15

Die P0-Laufzeit-Haertung ist implementiert und lokal gegen PostgreSQL, HTTP, Prisma,
Mock-Payment und Mock-Mail verarbeitet worden.

Abgeschlossen:

- Netto, MwSt. und Brutto werden in Kunden- und Admin-Ansichten explizit beschriftet.
- Der Order-Snapshot `targetAreaGeoJson` ist in Kunden-, Admin- und Reportpfaden die primaere Gebietsquelle; historische Relationdaten bleiben nur Fallback.
- Preispropagierung aktualisiert auch den verschachtelten Quote-/Gebiets-Snapshot und dessen Fingerprint. Offene Checkout-Zahlungen werden bei Preis- oder Gebietskorrekturen invalidiert.
- Direkter Checkout bleibt moeglich; eine Anfrage wird vor Adminannahme mit `PAYMENT_NOT_ALLOWED_BEFORE_REVIEW` blockiert.
- Unbezahlte Korrekturen ersetzen Snapshot, Segmente und Relation atomar. Bezahlte Orders bleiben gesperrt.
- Refund-Fehler werden als `FAILED` gespeichert und nicht als Erfolg gemeldet. Ablehnung und Kundenbenachrichtigung sind idempotent.
- Kritische Dispatch-Zuweisungen werden bei Quote-, Preis-, Mengen- oder Gebietsabweichung mit `ORDER_INTEGRITY_FAILED` blockiert.
- Multi-Segment-Dispatch prueft getrennte Segmente, Mengen und Zuweisungen. Eine gueltige, aber manipulierte Gebietsreferenz wird im Runtime-Test mit 409 abgewiesen.
- Die Admin-Auftragsansicht zeigt Teilgebiete, Lager, Zuweisung, Tourstatus und Mengen ohne die Kunden-/Print-Fulfillment-Pfade zu vermischen.

Nachweise:

- Prisma Validate/Generate, TypeScript, Lint und Produktions-Build sind gruen.
- Modul-27.1-Contract, Dispatch-Contract, Runtime, Playwright, Customer Order Area/Checkout, Module 16, Module 24, Module 27, Pricing-Propagation und die relevanten Tenant-/Payment-/Warehouse-/Logistics-Tests sind gruen.
- Der A/B-IDOR-Test wurde gegen den bereits laufenden lokalen Server ausgefuehrt, weil ein zweiter Next-Dev-Server den gemeinsamen `.next/dev`-Lock nicht verwenden kann.

Offene Betriebsrisiken:

- Playwright meldet weiterhin `map=fallback-observed`. Eine echte Google-Maps-Browserkarte wurde in dieser lokalen Testumgebung nicht verifiziert; dafuer muessen Produktions-Key, Map-ID, Boundary-Layer und erlaubte Domain aktiv konfiguriert sein.
- Stripe wurde lokal nur ueber den vorhandenen Mock-/Contract-Pfad geprueft. Ein echter Live-Checkout, Webhook-Signatur-Flow und Provider-Refund muessen mit Stripe-Testmodus bzw. kontrolliertem Live-Run separat nachgewiesen werden.
- Der Notification-Worker ist mit `EMAIL_PROVIDER=mock` nachgewiesen. SMTP/Resend-Zustellung und Zustellbarkeit sind extern noch nicht verifiziert.
- Die laufenden Runtime-Tests verwenden die lokale Seed-/Testdatenbank und sind kein Beleg fuer produktive Datenqualitaet oder echte Google-/Haushaltsdaten.
