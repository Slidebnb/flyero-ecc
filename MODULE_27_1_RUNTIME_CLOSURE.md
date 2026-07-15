# Modul 27.1: P0 Runtime Closure

## Ziel

Modul 27.1 schliesst die kritischen Laufzeitluecken im Kernprozess:

`Planung -> serverseitiger Quote -> Auftragssnapshot -> Adminpruefung -> Zahlung -> Rechnung/Fulfillment -> Disposition`

Preise, Status, Gebietssnapshot und Zahlungsbetrag werden nicht aus der Browseransicht uebernommen.

## Umgesetzt

- `ACCEPTED_AWAITING_PAYMENT` fuer angenommene Anfragen ohne abgeschlossene Zahlung.
- Annahme einer Anfrage erstellt genau einen Checkout und bleibt bei Wiederholung idempotent.
- Zahlung nach angenommener Anfrage fuehrt nach Integritaetspruefung automatisch zu `APPROVED`.
- Direkte Zahlung bleibt bis zur Adminpruefung in `PAID_WAITING_FOR_ADMIN_REVIEW`.
- Rechnung und Fulfillment werden nach Flyerquelle getrennt ausgefuehrt:
  - eigene Flyer: Lager-/Lieferprozess
  - Druck durch FLYERO: Druckauftrag
- Wiederholte Freigaben erzeugen keine zweite Rechnung, Lieferung oder Kundenfreigabe-Nachricht.
- Bezahlte preis- oder gebietsrelevante Kundenkorrekturen liefern `409 PAID_ORDER_REQUIRES_ADMIN_CHANGE`.
- Korrekturen ersetzen Teilgebiete in einer Transaktion, loeschen die alte Segmentrelation und stornieren offene Zahlungen.
- Auftragssnapshot `targetAreaGeoJson` ist fuer Kundenkarte und Dashboard die primaere Quelle.
- `DispatchAssignment` speichert `segmentId`; bei Mehrgebietsauftraegen bleiben Teilgebiet und Tour getrennt.
- Notification-Worker beansprucht Queue-Eintraege atomar vor dem Versand.
- `audit-order-integrity.mjs` ist lesend; `repair-order-integrity.mjs` bleibt standardmaessig Dry-Run und fuehrt derzeit keine automatische Reparatur aus.
- Admin-Reviews werden auf die aktive Tenant-Zugehoerigkeit begrenzt; ein globaler Plattform-Admin kann weiterhin plattformweit arbeiten.

## Statuskette

- `SUBMITTED -> ACCEPTED_AWAITING_PAYMENT -> APPROVED` nach erfolgreicher Zahlung und Integritaetspruefung.
- `PAYMENT_PENDING -> PAID_WAITING_FOR_ADMIN_REVIEW -> APPROVED`
- `WAITING_FOR_CUSTOMER -> UNDER_REVIEW`
- Der Statuswechsel wird ueber die zentrale Order-State-Machine und den zentralen Review-Service validiert.

## Laufzeitpruefung

`npm run test:module27-1-runtime` startet bei Bedarf einen lokalen Next-Server auf Port `3000`, meldet Testkonten an und prueft gegen PostgreSQL:

- Mehrere Teilgebiete werden einzeln gespeichert.
- Netto, MwSt. und Brutto bleiben konsistent.
- Unverbindliche Anfrage erzeugt keine Zahlung.
- Adminannahme erzeugt einen Checkout.
- Wiederholte Annahme erzeugt keinen zweiten Zahlungsdatensatz.
- Mock-Zahlung nach Annahme schliesst Rechnung und eigenen Flyer-Fulfillmentpfad ab.
- Direkte Zahlung wartet auf Adminfreigabe.
- Kundenkorrektur ersetzt Teilgebiete und blockiert nach Zahlung.

Die Einzeldateien unter `tests/*-runtime.mjs` verweisen auf dieselbe echte HTTP-/PostgreSQL-Laufzeitsuite. Sie sind bewusst keine String- oder ReadFile-only-Tests.

## Betrieb

Vor Deployment:

```text
npx prisma validate
npm run prisma:generate
npx prisma migrate deploy
npm run lint
npm run build
npm run test:module27-1-contract
npm run test:module27-1-runtime
```

Die Runtime-Suite verwendet Mock-Zahlungen nur in isolierten Testumgebungen. In Produktion muss `ENABLE_MOCK_PAYMENTS=false` bleiben; echte Zahlungen laufen ueber Stripe-Webhooks.

## Bewusst noch offen

- Die externe GPS-/Foto-Nachweispruefung bleibt ein eigener Admin-/Reportprozess und wird nicht durch diesen Order-P0-Test simuliert.
- Automatische Reparaturen von historischen Orderdaten bleiben gesperrt, bis ein Admin die Diagnose fachlich bestaetigt.
- Fuer vollstaendige deutschlandweite Dispatch-Abdeckung muessen aktive Lager-/Partnerregionen separat gepflegt werden.
