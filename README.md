# ECC Flyer-Verteilplattform

Dieses Repository enthaelt das erste technische Fundament fuer eine skalierbare Flyer-Verteilplattform. In dieser Phase wurden bewusst nur Projektstruktur, Prisma-Datenmodell, Rollen/Auth und minimale Login-/Registrierungsseiten umgesetzt.

## Stack

- Next.js App Router mit TypeScript
- PostgreSQL als Ziel-Datenbank
- Prisma ORM
- HTTP-only JWT-Session-Cookie mit `jose`
- Passwort-Hashing mit `bcryptjs`
- Validierung mit `zod`

## Projektstruktur

```text
prisma/
  schema.prisma              Datenmodell, Rollen, Status-Enums
src/
  app/
    api/auth/                Auth-Endpunkte
    login/                   Minimale Login-Seite
    register/customer/       Minimale Kundenregistrierung
    register/distributor/    Minimale Verteilerregistrierung
    page.tsx                 Kleine Auth-Startseite
  lib/
    auth.ts                  Session-Cookie und JWT-Helfer
    prisma.ts                Prisma Client Singleton
    request.ts               Request-/Response-Helfer
    validators.ts            Zod-Schemas
```

## Rollen

Die Plattform ist von Anfang an rollenbasiert vorbereitet:

- `CUSTOMER`
- `DISTRIBUTOR`
- `WAREHOUSE_STAFF`
- `ADMIN`
- `SUPPORT_DISPATCHER`

Verteiler erhalten zusaetzlich einen eigenen Review-Status. Ein Verteiler mit `PENDING_REVIEW` ist registriert, aber noch nicht fuer Auftraege freigegeben.

## Prisma-Datenmodell

Das Schema enthaelt die Kernmodelle aus dem MVP-Plan:

- `User`
- `CustomerProfile`
- `DistributorProfile`
- `Order`
- `WarehouseItem`
- `DistributionTour`
- `GpsPoint`
- `PhotoProof`
- `Report`
- `Invoice`
- `SupportTicket`
- `AuditLog`
- `Notification`

Die Datenstruktur ist nicht auf Koblenz hartcodiert. Orte, Zielgebiete und Adressen sind generisch modelliert, damit spaeter deutschlandweite Skalierung moeglich bleibt.

## Auth-Endpunkte

```text
POST /api/auth/register-customer
POST /api/auth/register-distributor
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/verify-email
GET  /api/auth/me
```

Registrierung und Login setzen ein HTTP-only Session-Cookie. Passwoerter werden mit `bcryptjs` gehasht. E-Mail-Verifizierung ist ueber `EmailVerificationToken` und `POST /api/auth/verify-email` vorbereitet. Ein echter Mailversand ist in dieser ersten Phase noch nicht enthalten, weil noch kein Mail-Provider festgelegt wurde.

## Setup

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. Environment-Datei anlegen:

```bash
cp .env.example .env
```

3. `DATABASE_URL` und `AUTH_SECRET` in `.env` setzen.

`AUTH_SECRET` muss mindestens 32 Zeichen lang sein.

4. Prisma Client generieren:

```bash
npm run prisma:generate
```

5. Datenbankmigration ausfuehren:

```bash
npm run prisma:migrate
```

6. Dev-Server starten:

```bash
npm run dev
```

Danach ist die App unter `http://localhost:3000` erreichbar.

## Minimal vorhandene Seiten

- `/`
- `/login`
- `/register/customer`
- `/register/distributor`

Weitere Ausbaustufen bauen schrittweise auf diesem Fundament auf. Rechnungen, Stripe, Auszahlungen und Live-Tracking fuer Kunden bleiben weiterhin bewusst getrennte spaetere Module.

## Modul 2: Onboarding, Rollen und Admin-Pruefung

Enthalten:

- Kunden-Dashboard unter `/customer/dashboard`
- Kundenprofil unter `/customer/profile`
- Verteiler-Dashboard unter `/distributor/dashboard`
- Verteilerprofil unter `/distributor/profile`
- Admin-Dashboard unter `/admin/dashboard`
- Verteilerpruefung unter `/admin/distributors`
- Verteiler-Detailpruefung unter `/admin/distributors/:id`
- Rollenpruefung ueber `src/proxy.ts`
- AuditLogs fuer Registrierung, Login, Logout, E-Mail-Bestaetigung, Profilupdates und Admin-Statuswechsel
- interne Notifications fuer Registrierung, Profilupdates und Verteilerfreigabe/-ablehnung
- Seed-Daten fuer 3 Kunden, 5 Verteiler und 1 Admin

Neue und erweiterte Endpunkte:

```text
POST /api/customer/profile
POST /api/distributor/profile
POST /api/admin/distributors/:id/status
```

Seed ausfuehren:

```bash
npm run prisma:seed
```

Modul-2-Smoke-Test:

```bash
npm run test:module2
```

## Modul 3: Auftragserstellung fuer Kunden

Enthalten:

- Auftragserstellung unter `/customer/orders/new`
- Auftragsliste unter `/customer/orders`
- Kundendetails unter `/customer/orders/:id`
- Admin-Auftragsliste unter `/admin/orders`
- Admin-Auftragsdetails unter `/admin/orders/:id`
- Statusmaschine fuer definierte Statuswechsel
- zentrale Preisberechnung ueber `PricingRule` und `PricingSetting`
- AuditLogs fuer Auftragserstellung, Updates, Statuswechsel, Genehmigung, Ablehnung, Storno, Preis- und Notizaenderungen
- interne Notifications fuer Kunden und Admins
- 10 realistische Beispielauftraege im Seed

Neue Datenbankmodelle:

- `OrderStatusEvent`
- `PricingSetting`
- `PricingRule`

Erweiterte Datenbankmodelle:

- `Order` mit ServiceType, Verteilgebiet, Flyer-/Terminangaben, Preisfeldern, Adminnotizen und Lager-vorbereiteter eindeutiger Auftragsnummer.

Neue und erweiterte Endpunkte:

```text
GET    /api/customer/orders
GET    /api/customer/orders/:id
POST   /api/customer/orders
PUT    /api/customer/orders/:id
DELETE /api/customer/orders/:id

GET   /api/admin/orders
GET   /api/admin/orders/:id
PATCH /api/admin/orders/:id/status
PATCH /api/admin/orders/:id/price
PATCH /api/admin/orders/:id/note
```

Modul-3-Smoke-Test:

```bash
npm run test:module3
```

## Modul 4: Lagerverwaltung, QR-Code und Wareneingang

Enthalten:

- Lager-Dashboard unter `/warehouse/dashboard`
- Wareneingang unter `/warehouse/checkin`
- Lagerbestandsliste mit Filtern unter `/warehouse/inventory`
- Lagerbestandsdetail mit QR-Code-PNG, Download und Druck unter `/warehouse/inventory/:id`
- Lagerplatzverwaltung unter `/warehouse/locations`
- Admin-Lageruebersicht unter `/admin/warehouse`
- Lagerstatus in Kunden-Auftragsdetails
- Lagerrolle `WAREHOUSE_STAFF` mit eigenem Login-Ziel
- QR-Code-Erzeugung als PNG-Data-URL mit maschinenlesbarer Payload
- Historie pro Lagerbestand ueber `WarehouseHistory`
- Vorbereitung fuer Modul 5 ueber `pickupToken`, `pickupStatus`, `reservedDistributorId` und `preparedAt`
- Seed-Daten fuer 1 Lageruser, 1 Lager, 40 Lagerplaetze und 10 Lagerbestaende mit QR-Code

Demo-Login:

```text
warehouse@example.com
DemoPasswort123!
```

Neue Datenbankmodelle:

- `Warehouse`
- `WarehouseLocation`
- `WarehouseInventory`
- `WarehouseHistory`

Neue und erweiterte Endpunkte:

```text
GET  /api/warehouse
GET  /api/warehouse/inventory
GET  /api/warehouse/inventory/:id
POST /api/warehouse/checkin
POST /api/warehouse/location
POST /api/warehouse/status
POST /api/warehouse/qrcode
GET  /api/warehouse/locations
POST /api/warehouse/locations
GET  /api/admin/warehouse
```

Modul-4-Smoke-Test:

```bash
npm run test:module4
```

## Modul 5: Verteiler-App, QR-Scan, GPS und Touren

Enthalten:

- mobile-first Verteiler-Dashboard unter `/distributor/dashboard`
- mobile Tourdetailseite unter `/distributor/tours/:id`
- Admin-Tourenliste unter `/admin/tours`
- Admin-Tourpruefung unter `/admin/tours/:id`
- Tourzuweisung durch Admin fuer abholbereite Lagerbestaende
- QR-basierte Abholbestaetigung gegen den echten Lagerbestand
- Tourstart mit Browser-Geolocation-Freigabe
- GPS-Speicherung ueber Server-Service, nicht direkt aus UI-Businesslogik
- GPS-Puffer im Browser per `localStorage` bei Offline-Faellen
- automatischer Upload gepufferter GPS-Punkte beim `online`-Event
- Pause/Fortsetzen mit Pausezeit-Berechnung
- Fotoaufnahme bevorzugt per Kamera (`capture="environment"`)
- Tourabschluss mit Restflyern, Notiz und Status `UNDER_REVIEW`
- Admin-Notifications und AuditLogs fuer Tour- und GPS-/Foto-Ereignisse
- PWA-Grundlage mit Manifest und Service Worker

Neue und erweiterte Datenbankfelder:

- `DistributionTour.inventoryId`
- `DistributionTour.pickupTime`
- `DistributionTour.startTime`
- `DistributionTour.endTime`
- `DistributionTour.pauseTime`
- `DistributionTour.totalPauseSeconds`
- `DistributionTour.totalDistanceMeters`
- `DistributionTour.totalDurationSeconds`
- `GpsPoint.altitude`
- `GpsPoint.battery`
- `GpsPoint.source`
- `GpsPoint.status`
- `GpsPoint.flags`
- `PhotoProof.accuracy`
- `PhotoProof.source`
- `PhotoProof.metadata`

Tourstatus:

```text
ASSIGNED
READY
PICKED_UP
STARTED
PAUSED
RESUMED
COMPLETED
UNDER_REVIEW
APPROVED
```

Neue APIs:

```text
GET  /api/distributor/tours
GET  /api/distributor/tours/:id
POST /api/distributor/tours/:id/pickup
POST /api/distributor/tours/:id/start
POST /api/distributor/tours/:id/pause
POST /api/distributor/tours/:id/resume
POST /api/distributor/tours/:id/complete
POST /api/distributor/tours/:id/photo
POST /api/distributor/tours/:id/gps

GET  /api/admin/tours
POST /api/admin/tours
GET  /api/admin/tours/:id
```

GPS-Architektur:

- Die UI sammelt nur Browser-Geolocation-Daten und puffert sie bei Netzverlust.
- Die Bewertung und Speicherung laufen zentral in `src/lib/tours.ts`.
- Manipulationsschutz-MVP markiert schwaches/deaktiviertes GPS, keine Bewegung, grosse Spruenge, hohe Geschwindigkeit und Zeitluecken als Flags.
- Es gibt noch keine automatische Sperre und keine Google-Maps-Abhaengigkeit.

Modul-5-Smoke-Test:

```bash
npm run test:module5
```

## Modul 6: Google Maps, RouteAnalysis, Adminpruefung und Berichtsvorschau

Enthalten:

- gekapselte Kartenkomponente `RouteMap`
- Google Maps JavaScript API optional ueber `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- stabiler Fallback ohne Google-Key mit Koordinatenliste
- serverseitiger Static-Maps-Fallback in `src/lib/mapSnapshot.ts`
- Route-Auswertung in `src/lib/routeAnalysis.ts`
- Admin-Tourpruefung unter `/admin/tours/:id`
- Kunden-Berichtsvorschauen unter `/customer/reports` und `/customer/reports/:id`
- Review-Aktionen: freigeben, ablehnen, Rueckfrage, interne Notiz
- Report-Preview-Daten ohne PDF-Generierung
- Datenschutzfilter fuer Kundenansicht mit anonymisierter Verteilerkennung

Google Maps ENV:

```text
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=""
GOOGLE_MAPS_SERVER_KEY=""
```

`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` ist nur fuer die Maps JavaScript API im Browser gedacht und sollte in Google Cloud per Domain eingeschraenkt werden. `GOOGLE_MAPS_SERVER_KEY` bleibt serverseitig und ist fuer spaetere Static-Maps-Snapshots vorbereitet.

Fallback-Verhalten:

- Ohne Browser-Key rendert `RouteMap` keinen Fehler, sondern eine Koordinatenliste mit Hinweis.
- Ohne Server-Key liefert `mapSnapshot.ts` einen stabilen Karten-Fallback fuer Bericht und PDF.

RouteAnalysis berechnet:

- GPS-Punkte, Start/Ende, Gesamtzeit, Pausenzeit, aktive Zeit
- Strecke, Durchschnitts- und Maximalgeschwindigkeit
- GPS-Luecken, Spruenge, Zielgebietsabweichungen und Flags

Flags:

```text
NO_GPS
TOO_FEW_POINTS
LARGE_GAP
UNREALISTIC_SPEED
NO_MOVEMENT
OUTSIDE_TARGET_AREA
MISSING_START
MISSING_END
```

Neue APIs:

```text
GET  /api/admin/tours/:id
POST /api/admin/tours/:id/approve
POST /api/admin/tours/:id/reject
POST /api/admin/tours/:id/clarify
PATCH /api/admin/tours/:id/note

GET /api/customer/reports
GET /api/customer/reports/:id

GET /api/tours/:id/route-analysis
```

Datenschutz Kundensicht:

- Kunden sehen nur freigegebene Touren.
- Kunden sehen keine Verteileradresse, Telefonnummer, E-Mail, Geburtsdatum, internen Adminnotizen oder unnoetige Rohdaten.
- Verteiler erscheinen anonymisiert, z.B. `Verteiler #204`.

Modul-6-Demoablauf:

1. Admin oeffnet `/admin/tours`.
2. Admin prueft eine Tour unter `/admin/tours/:id`.
3. Admin sieht Karte/Fallback, Fotos, GPS, Flags, AuditLog und Statushistorie.
4. Admin gibt die Tour frei.
5. Kunde sieht die Berichtsvorschau unter `/customer/reports`.
6. PDF-Bericht folgt erst in einem spaeteren Modul.

Modul-6-Smoke-Test:

```bash
npm run test:module6
```

## Modul 7: Disposition, Zuweisung und Kapazitaetsplanung

Enthalten:

- Admin-Dispatch-Dashboard unter `/admin/dispatch`
- Metriken fuer offene, unzugewiesene, reservierte, abholbereite, heute geplante und heute erledigte Auftraege
- Filter nach Stadt, Verteiler, Status, Datum und Lager
- passende Verteilerliste direkt am Auftrag unter `/admin/orders/:id`
- automatische Verteilerempfehlung nach Freigabe, Verfuegbarkeit, bevorzugten Gebieten, Einsatzradius, aktiven Touren und Kapazitaet
- Kapazitaetsfelder am Verteilerprofil: `maxToursPerDay`, `maxFlyersPerDay`, `currentAssignedFlyers`, `currentAssignedTours`, `availableToday`
- Warnhinweis `Kapazitaet ueberschritten`
- Dispatch-Anfragen im Verteiler-Dashboard mit Annehmen/Ablehnen
- Ablehnungsgruende: Keine Zeit, Krank, Zu weit, Sonstiges
- Annahme reserviert den Lagerbestand verbindlich und setzt die Tour auf `READY`
- Ablehnung gibt den Auftrag zur erneuten Disposition frei
- AuditLogs fuer `dispatch.assigned`, `dispatch.unassigned`, `dispatch.accepted`, `dispatch.rejected` und vorbereitete Reassignments
- Notifications fuer neue Auftraege, Annahmen, Ablehnungen und Kapazitaetswarnungen
- Seed-Daten mit mindestens 20 Auftraegen, 10 Verteilern, verschiedenen Kapazitaeten, reservierten und abgelehnten Dispatch-Faellen

Neue Datenbankmodelle und Enums:

- `DispatchAssignment`
- `DispatchAssignmentStatus`
- `DispatchRejectionReason`

Neue APIs:

```text
GET  /api/admin/dispatch
POST /api/admin/orders/:id/assign
GET  /api/distributor/available-orders
POST /api/distributor/orders/:id/accept
POST /api/distributor/orders/:id/reject
```

Bewusst noch nicht enthalten:

- PDF-Berichte
- Rechnungen
- Stripe
- automatische Auszahlungen
- vollautomatischer Auto-Dispatch
- KI-Optimierung oder Routenoptimierung nach Distanz/Workload

Modul-7-Smoke-Test:

```bash
npm run test:module7
```

## Modul 8: Gebietsmanagement und Karteneditor

Enthalten:

- wiederverwendbare Verteilgebiete mit `DistributionArea`
- einzelne Polygon-Geometrien mit `AreaPolygon`
- vorbereitete Haushaltsberechnung mit `AreaHouseholdEstimate`
- Gebietshistorie mit `AreaHistory`
- Google Maps im Browser ueber `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- serverseitiger Key-Platzhalter `GOOGLE_MAPS_SERVER_KEY`
- Fallback ohne Keys: Formulare, GeoJSON und strukturierte Gebietsdaten bleiben nutzbar
- Karteneditor `DistributionAreaEditor` mit Polygon zeichnen, bearbeiten, verschieben, loeschen, mehreren Polygonen und Auto-Zoom
- Gebietstypen: PLZ, Stadt, Ortsteil, Polygon, Radius
- Auftragserstellung mit Gebietsauswahl, Karte, Vorschau, Flaeche, Haushalten, geschätzten Flyern und geschätzter Strecke
- Admin-Gebietsverwaltung unter `/admin/areas`
- Gebiete speichern, bearbeiten, kopieren, deaktivieren und als JSON/GeoJSON exportieren
- AuditLogs fuer `area.created`, `area.updated`, `area.deleted`, `area.assigned`
- Notifications fuer geaenderte oder geloeschte Gebiete
- Seed-Daten mit mindestens 20 Beispielgebieten aus PLZ, Ortsteilen, Radius- und Polygongebieten

Neue Datenbankmodelle und Enums:

- `DistributionArea`
- `AreaPolygon`
- `AreaHouseholdEstimate`
- `AreaHistory`
- `DistributionAreaType`
- `DistributionAreaStatus`
- `HouseholdEstimateMethod`

Neue und erweiterte APIs:

```text
GET    /api/areas
POST   /api/areas
PUT    /api/areas/:id
DELETE /api/areas/:id
GET    /api/orders/:id/area
```

ENV:

```text
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=""
GOOGLE_MAPS_SERVER_KEY=""
```

Bewusst noch nicht enthalten:

- PDF
- Rechnungen
- Stripe
- Live Tracking
- automatische Haushaltsberechnung aus externen Datenquellen
- Straßenzug-Auswahl

Modul-8-Smoke-Test:

```bash
npm run test:module8
```

## Modul 9: Professionelle Verteilberichte, PDF und Online-Bericht

Enthalten:

- Admin-Berichtsuebersicht unter `/admin/reports`
- Admin-Berichtsdetail unter `/admin/reports/:id`
- Report-Aktionen direkt in der Admin-Tourpruefung nach Tourfreigabe
- Kunden-Berichtsliste unter `/customer/reports`
- professioneller Online-Verteilbericht unter `/customer/reports/:id`
- serverseitige PDF-Erzeugung ohne externe Abhaengigkeit
- PDF-Dateien unter `/public/generated/reports`
- digitale Berichtnummer, Verification-Code, PDF-Checksumme, Version und Online-URL
- Report-Templates `STANDARD`, `IMMOBILIEN`, `RESTAURANT`, `FRANCHISE`, `CUSTOM_BRANDING`
- GPS-Qualitaetsscore 0 bis 100 mit Kundenlabel `Sehr gut`, `Gut` oder `Auffaellig`
- Static-Maps-URL-Vorbereitung mit `GOOGLE_MAPS_SERVER_KEY` und stabiler Fallback ohne Key
- Kundendatenschutz: anonymisierte Verteilerkennung, keine privaten Verteilerkontakte, keine internen Adminnotizen, keine rohen Fraud-Daten
- AuditLogs fuer `report.generated`, `report.regenerated`, `report.published`, `report.archived`, `report.downloaded`, `report.viewed`, `report.verify_checked`
- Notifications fuer erzeugte und veroeffentlichte Berichte
- Seed-Daten mit veroeffentlichtem PDF-Bericht und zusaetzlichem Draft-Bericht

Neue und erweiterte Datenbankfelder:

- `Report.reportNumber`
- `Report.customerId`
- `Report.reportType`
- `Report.template`
- `Report.onlineUrl`
- `Report.pdfUrl`
- `Report.generatedAt`
- `Report.approvedAt`
- `Report.approvedById`
- `Report.downloadedAt`
- `Report.version`
- `Report.checksum`
- `Report.verificationCode`

Neue APIs:

```text
GET  /api/admin/reports
GET  /api/admin/reports/:id
POST /api/admin/tours/:id/generate-report
POST /api/admin/reports/:id/regenerate
POST /api/admin/reports/:id/publish
POST /api/admin/reports/:id/archive

GET /api/customer/reports
GET /api/customer/reports/:id
GET /api/customer/reports/:id/download

GET /api/reports/verify/:code
```

Bewusst noch nicht enthalten:

- Rechnungen
- Stripe
- Auszahlungen
- Lexware/DATEV
- Live-Tracking waehrend laufender Touren
- automatische Kundenkommunikation per echtem Mailprovider

Modul-9-Smoke-Test:

```bash
npm run test:module9
```

## Modul 10: Checkout, Stripe und Zahlungsflow mit Vorkasse

Flyero arbeitet ab diesem Modul mit Vorkasse. Ein Auftrag wird nach der Erstellung
auf `PAYMENT_PENDING` gesetzt und gelangt erst nach einem gueltig signierten
Stripe-Webhook in `PAID_WAITING_FOR_ADMIN_REVIEW`. Erst danach darf der Admin den
Auftrag genehmigen.

Enthalten:

- Stripe Checkout ueber `/api/payments/checkout`
- keine eigene Kreditkartenmaske
- Stripe Webhook unter `/api/stripe/webhook`
- Payment-Domain mit `Payment`, `PaymentEvent`, `Refund`, `PaymentProvider` und `PaymentStatusHistory`
- Adminseite `/admin/payments` mit Filtern, Stripe-Referenzen, Webhookhistorie und Refund-Aktion
- Kundenseite `/customer/payments` mit Zahlungsstatus, Transaktionsdatum und Stripe-Referenz
- Retry bei fehlgeschlagener Zahlung ohne doppelte bezahlte Auftraege
- automatische Admin-Notification nach erfolgreicher Zahlung
- automatische Rueckerstattung bei Admin-Ablehnung bezahlter Auftraege
- vorbereitete Teilrueckerstattung ueber `RefundType.PARTIAL`

Neue APIs:

```text
POST /api/payments/checkout
GET  /api/customer/payments
GET  /api/customer/payments/:id

POST /api/stripe/webhook

GET  /api/admin/payments
POST /api/admin/payments/:id/refund
```

Stripe ENV:

```text
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""
```

Stripe Setup:

1. Stripe Secret Key in `STRIPE_SECRET_KEY` setzen.
2. Webhook-Endpunkt in Stripe auf `/api/stripe/webhook` konfigurieren.
3. Webhook Secret in `STRIPE_WEBHOOK_SECRET` setzen.
4. Fuer lokale Entwicklung kann die Stripe CLI genutzt werden:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Testkarten:

- Erfolgreich: `4242 4242 4242 4242`
- Abgelehnt: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

Webhook-Konzept:

- Zahlungen werden nie allein durch das Frontend bestaetigt.
- `checkout.session.completed` setzt Payment auf `PAID` und Order auf `PAID_WAITING_FOR_ADMIN_REVIEW`.
- Fehlgeschlagene oder abgelaufene Sessions setzen Payment auf `FAILED` und Order auf `PAYMENT_FAILED`.
- `PaymentEvent.stripeEventId` ist eindeutig, damit doppelte Webhooks idempotent verarbeitet werden.

Refunds:

- Admin-Ablehnung eines bezahlten Auftrags startet eine volle Rueckerstattung.
- Admin kann in `/admin/payments` Refunds ausloesen.
- Teilrueckerstattung ist im Datenmodell vorbereitet, aber noch ohne eigene UI.

Bewusst noch nicht enthalten:

- steuerliche Rechnungen
- Lexware/DATEV
- Auszahlungen an Verteiler
- eigene Payment-Element- oder Kreditkartenmaske

Modul-10-Smoke-Test:

```bash
npm run test:module10
```

## Modul 11: Rechnungen nach Zahlung und Rechnungs-PDF

Rechnungen entstehen erst nach erfolgreicher Stripe-Zahlung und anschliessender
Admin-Genehmigung des bezahlten Auftrags. Der Zahlungsprozess bleibt von der
steuerlichen Rechnung getrennt.

Rechnungsablauf:

1. Kunde erstellt Auftrag.
2. Stripe-Zahlung ist erfolgreich.
3. Auftrag steht auf `PAID_WAITING_FOR_ADMIN_REVIEW`.
4. Admin genehmigt den Auftrag.
5. Auftrag steht auf `APPROVED`.
6. Rechnung wird idempotent erzeugt.
7. PDF wird serverseitig unter `/public/generated/invoices` gespeichert.
8. Kunde sieht Rechnung im Portal und kann das PDF herunterladen.

Rechnungsnummern:

```text
FLY-RE-2026-000001
```

Das Format ist jahresbasiert vorbereitet und eindeutig. Doppelte Rechnungserzeugung
fuer denselben Auftrag wird ueber `Invoice.orderId` und die Service-Logik verhindert.

Neue Datenbankstruktur:

- `Invoice.paymentId`
- `Invoice.currency`
- `Invoice.invoiceDate`
- `Invoice.serviceDate`
- `Invoice.dueDate`
- `Invoice.subtotalNet`
- `Invoice.vatRate`
- `Invoice.totalGross`
- `Invoice.notes`
- `InvoiceItem`
- `CreditNote`

Neue Seiten:

```text
/customer/invoices
/customer/invoices/:id
/admin/invoices
/admin/invoices/:id
```

Neue APIs:

```text
GET  /api/customer/invoices
GET  /api/customer/invoices/:id
GET  /api/customer/invoices/:id/download

GET  /api/admin/invoices
GET  /api/admin/invoices/:id
POST /api/admin/invoices/:id/regenerate-pdf
POST /api/admin/invoices/:id/cancel

POST /api/internal/orders/:id/create-invoice
```

PDF-Technik:

- serverseitige PDF-Erzeugung in `src/lib/invoices.ts`
- PDF-Speicherort: `/public/generated/invoices`
- Inhalt: Flyero Text/Logo, Rechnungsnummer, Rechnungsdatum, Kunde, Rechnungsadresse,
  Auftrag, Zahlungsreferenz, Leistungsbeschreibung, Netto, MwSt., Brutto, Hinweis
  `bereits bezahlt`, Zahlungsdatum und Footer-Platzhalter.

Demo-Login:

Alle Demo-Logins stehen in `DEMO_BENUTZER.txt`.

Modul-11-Smoke-Test:

```bash
npm run test:module11
```

## Naechste sinnvolle Schritte

1. Automatische Haushaltsdaten je Gebiet importieren.
2. Straßenzug-Auswahl auf Basis der `DistributionArea`-Geometrien.
3. Auto-Dispatch-Regeln auf Basis der vorbereiteten Gebiets- und Dispatch-Struktur.
4. Optimierung nach Distanz, Workload und bevorzugten Verteilern.
5. Modul 12: Lexware-/DATEV-Export vorbereiten.
6. Abrechnung, Auszahlungen und Mahnwesen spaeter getrennt entwickeln.
## Modul 12: Unternehmens-Einstellungen, Branding, Preise und Systemkonfiguration

Modul 12 fuehrt zentrale Settings ein, damit Flyero nicht mehr von hartcodierten Firmen-, Rechnungs-, Branding-, Lager- oder Preiswerten abhaengt.

Neue Admin-Seiten:

- `/admin/settings`
- `/admin/settings/company`
- `/admin/settings/branding`
- `/admin/settings/pricing`
- `/admin/settings/numbering`
- `/admin/settings/warehouses`
- `/admin/settings/payments`
- `/admin/settings/maps`
- `/admin/settings/users`

Neue Datenbereiche:

- `CompanySettings`: Firmenstammdaten, Adresse, Steuerdaten, Bankdaten, Logo-URL
- `BrandingSettings`: Farben, Logo-URL, Report-Footer, Invoice-Footer
- `NumberingSettings`: zentrale Nummernkreise fuer Rechnungen, Berichte und Auftraege
- `SystemSettings`: MwSt., Waehrung, Zahlungsziel und Review-/Payment-Schalter
- erweiterte `Warehouse`-Felder fuer aktiv/inaktiv, Standardlager, Oeffnungszeiten und Ansprechpartner

Preisregeln bleiben bewusst in `PricingSetting` und `PricingRule`. Die Preisberechnung laeuft weiterhin zentral ueber `src/lib/pricing.ts`; UI und APIs speichern nur Regeln und Einstellungen.

ENV Keys bleiben ausserhalb der DB:

- Stripe Secret Key, Publishable Key und Webhook Secret werden nur als Status angezeigt.
- Google Maps Browser/Server Key werden nur als Status angezeigt.
- Keine geheimen Keys werden im Admin-UI ausgegeben oder in der Datenbank gespeichert.

Nummernkreise:

- `generateOrderNumber`
- `generateReportNumber`
- `generateInvoiceNumber`

Diese Funktionen nutzen kuenftig `NumberingSettings` und inkrementieren die naechste Nummer zentral.

Demoablauf:

1. Als `admin@example.com` anmelden.
2. `/admin/settings` oeffnen.
3. Firma, Branding, Preise, Nummernkreise, Lager, Zahlungen, Karten und interne Benutzer pruefen.
4. Eine Rechnung oder einen Bericht neu erzeugen und pruefen, dass Footer/Firmenwerte aus den Settings kommen.

## Modul 13: Accounting Export fuer Lexware und DATEV

Modul 13 bereitet den Buchhaltungsexport fuer Rechnungen, Zahlungen und Gutschriften vor. Es gibt noch keine Live-Synchronisation mit Lexware oder DATEV APIs. Stattdessen werden strukturierte Exportlaeufe erzeugt, historisiert und als CSV gespeichert.

Admin-Seite:

- `/admin/accounting`

Admin-APIs:

- `GET /api/admin/accounting/exports`
- `POST /api/admin/accounting/exports`
- `GET /api/admin/accounting/exports/:id`
- `GET /api/admin/accounting/exports/:id/download`
- `POST /api/admin/accounting/exports/:id/archive`

Exportformate:

- Lexware CSV fuer Rechnungen, Zahlungen und Gutschriften.
- DATEV CSV als fachlich zu pruefende Vorbereitung.
- Generic CSV als technischer Standardexport.

- `CSV_LEXWARE`: Rechnungsnummer, Rechnungsdatum, Kunde, Adresse, Netto, MwSt., Brutto, Zahlungsstatus, Zahlungsdatum, Auftragsnummer, Stripe Referenz und Leistungsbeschreibung.
- `CSV_DATEV`: DATEV-nahe Vorbereitungsstruktur mit Belegdatum, Belegnummer, Buchungstext, Betrag, Soll/Haben, Steuerschluessel, Debitor und Gegenkonto.
- `CSV_GENERIC`: technischer Standardexport fuer spaetere Weiterverarbeitung.

Speicherort:

- `/public/generated/accounting`
- Dateiname: `flyero-accounting-export-{exportNumber}.csv`

Wichtiger DATEV-Hinweis:

Der DATEV Export ist eine technische Vorbereitung und muss vor Live-Nutzung fachlich mit Steuerberater oder Buchhaltung geprueft werden. Konten, Steuerschluessel und Debitorenlogik sind im MVP bewusst vorbereitet, aber nicht final steuerberatend festgelegt.

Testablauf:

1. Als `admin@example.com` anmelden.
2. `/admin/accounting` oeffnen.
3. Zeitraum, Exporttyp und Format waehlen.
4. Export starten.
5. CSV herunterladen.
6. Export archivieren.

## Modul 14: Auto-Dispatch und Verteiler-Empfehlungen

Modul 14 fuehrt regelbasierte Auto-Dispatch-Empfehlungen ein. Das System bewertet passende Verteiler fuer abholbereite Auftraege und speichert Top-Empfehlungen als `AutoDispatchRecommendation`.

Scoring 0 bis 100:

- Verteiler ist freigegeben und aktiv
- Einsatzgebiet passt zu bevorzugten Gebieten
- Verfuegbarkeit passt
- Kapazitaet fuer Touren/Flyer ist frei
- Entfernung zu Lager oder Zielgebiet
- bisher abgeschlossene Touren
- Ablehnungsrate
- offene Touren
- Sperr-/Pause-Status fuehrt zum Ausschluss oder zu Warnungen

Admin-Funktionen:

- `/admin/dispatch` zeigt Top-Empfehlungen, Score, Gruende und Warnungen.
- Empfehlungen koennen erzeugt, ignoriert oder direkt zugewiesen werden.
- Auto-Assign kann optional versucht werden.

SystemSettings:

- `autoDispatchEnabled`: Standard `false`
- `autoDispatchMinScore`: Standard `85`

Wenn Auto-Dispatch deaktiviert ist oder der beste Score unter `autoDispatchMinScore` liegt, wird keine automatische Zuweisung vorgenommen und ein AuditLog `dispatch.auto_assign_skipped` erzeugt.

Warum regelbasiert, nicht KI:

- Das MVP muss nachvollziehbar, auditierbar und fuer Admins erklaerbar sein.
- Jeder Score entsteht aus konkreten Gruenden und Warnungen.
- Ein spaeteres KI-Modell kann auf denselben Recommendation-Daten aufbauen, ohne die operative Dispatch-Basis zu ersetzen.

## Modul 15: Kommunikation, Vorlagen und Nachrichtenzentrale

Modul 15 fuehrt die zentrale Notification Architektur ein. Bestehende Module sollen Benachrichtigungen nicht mehr direkt schreiben, sondern ueber `src/lib/notifications.ts` gehen. Der Service erzeugt weiterhin kompatible In-App-Eintraege in `Notification`, protokolliert aber zusaetzlich jede Nachricht als `NotificationMessage`, optionalen Versandauftrag als `NotificationQueue` und Verlauf als `NotificationLog`.

Neue Tabellen:

- `NotificationTemplate`: Vorlagen mit Zielgruppe, Kanal, Betreff, Body und Platzhaltern.
- `NotificationMessage`: gerenderte Nachricht pro Empfaenger.
- `NotificationQueue`: vorbereiteter Versand mit Status `PENDING`, `SENDING`, `SENT`, `FAILED`, `RETRY`.
- `NotificationPreference`: Benutzer-Einstellungen je Nachrichtentyp und Kanal.
- `NotificationLog`: revisionssicherer Verlauf fuer Erstellung, Versand, Fehler und Vorschau.

### Template-System

Seed-Daten liefern mindestens 20 Vorlagen fuer Kunden, Verteiler und Admins. Unterstuetzte Platzhalter sind:

`{{customerName}}`, `{{companyName}}`, `{{orderNumber}}`, `{{invoiceNumber}}`, `{{reportNumber}}`, `{{paymentAmount}}`, `{{trackingUrl}}`, `{{dashboardUrl}}`, `{{supportEmail}}`.

Das Rendering ersetzt unbekannte oder leere Werte stabil durch leere Strings. Weitere Platzhalter koennen ohne Migration ergaenzt werden, weil sie als Text und `placeholders`-Array an der Vorlage gespeichert werden.

### Queue

Versand passiert im MVP nie direkt. `createNotification` erstellt zuerst die Message und dann einen Queue-Eintrag. Ein spaeter Worker kann Queue-Eintraege mit Status `PENDING` oder `RETRY` abarbeiten und danach `notification.sent` oder `notification.failed` loggen. E-Mail ist vorbereitet; WhatsApp, SMS und Push sind als Kanaele im Datenmodell vorhanden, aber bewusst noch ohne Provider-Integration.

### Preferences und Nachrichtenzentralen

Benutzer koennen pro Nachrichtentyp und Kanal Einstellungen erhalten. Wenn keine Preference existiert, gilt die Nachricht als aktiv. Neue Seiten:

- `/admin/notifications`
- `/customer/notifications`
- `/distributor/notifications`

Alle Seiten bieten Filter nach ungelesen/gelesen, Typ und Datum. Admins sehen zusaetzlich Templates, Queue, Preferences und Logs. APIs:

- `GET /api/admin/notifications`
- `GET /api/customer/notifications`
- `GET /api/distributor/notifications`
- `POST /api/admin/templates`
- `PATCH /api/admin/templates/:id`
- `POST /api/admin/templates/:id/preview`

## Modul 16: Landingpage und Leadgewinnung

Modul 16 ergaenzt die oeffentliche FLYERO-Marketing-Website ohne Blog, CMS, Ads, Analytics oder Monitoring. Ziel ist ein sauberer Beta-Einstieg fuer Interessenten, Auftraggeber und Verteiler.

Oeffentliche Seiten:

- `/` mit Positionierung "Flyerverteilung, die man nachweisen kann.", Problem, Loesung, Ablauf, Features, Zielgruppen, Region und CTA.
- `/fuer-unternehmen` fuer Auftraggeber mit Nutzen, Ablauf, Vorkasse per Stripe, Nachweisen und Kontaktformular.
- `/fuer-verteiler` fuer Verteiler mit PWA-/QR-/GPS-Ablauf und Hinweis auf Freischaltungspruefung.
- `/preise` mit vorsichtiger Preisorientierung, ohne harte finale Preistabelle.
- `/so-funktionierts` mit 11-Schritt-Prozess vom Account bis Bericht/Rechnung.
- `/kontakt`, `/impressum`, `/datenschutz`, `/agb`.

### Leadflow

- Kontaktformulare senden an `POST /api/leads`.
- Leads werden in der Tabelle `Lead` gespeichert und mit `type`, `status`, `source`, `adminNote` und optionaler Archivierung verwaltet.
- Bei Lead-Erstellung entsteht ein AuditLog `lead.created`.
- Admins und Support/Dispatcher erhalten eine Notification vom Typ `LEAD_CREATED` mit dem Titel "Neuer Lead eingegangen.".
- Admin-Verwaltung erfolgt ueber `/admin/leads` sowie `GET /api/admin/leads` und `PATCH /api/admin/leads/:id`.

Zielgruppen:

- Immobilienmakler
- Restaurants und Lieferdienste
- Fitnessstudios
- Handwerksbetriebe
- Gebaeudedienstleister
- lokaler Einzelhandel
- Vereine und Events
- Franchise-Unternehmen

Demo-Ablauf:

1. Interessent oeffnet `/` oder eine Zielgruppenseite.
2. Anfrage wird ueber `/kontakt` oder ein eingebettetes Formular gesendet.
3. Admin sieht den Lead unter `/admin/leads`.
4. Admin setzt Status wie `CONTACTED`, `QUALIFIED`, `WON` oder `LOST`, pflegt eine Notiz und archiviert erledigte Leads.
5. Fuer echte Auftraege fuehrt der CTA weiter zur bestehenden Auftragserstellung unter `/customer/orders/new`.

Rechtliche Platzhalter:

- `/impressum`, `/datenschutz` und `/agb` sind bewusst professionelle Platzhalter fuer die Beta-Demo.
- Vor Livegang muessen alle Rechtstexte, Anbieterangaben, Auftragsverarbeiter, Speicherfristen, AGB und steuerlichen Angaben anwaltlich bzw. fachlich geprueft werden.

Test:

- `npm run test:module16-landing` prueft Seiten-HTTP-Status, Lead-Erstellung, Admin-Abruf, Statuswechsel, Seed-Leads, AuditLog, Notification sowie Datei-/Script-Praesenz.

Hinweis fuer das naechste Modul:

- Nach Modul 16 sollte Modul 17 Monitoring, Fehlerlogs und Betriebssicherheit behandeln. Es sollten keine weiteren Marketingfeatures vor Monitoring priorisiert werden.

## Modul 17: Monitoring, Fehlerlogs und Betriebssicherheit

Modul 17 macht FLYERO fuer Beta und Livebetrieb ueberwachbar. Es baut keine neuen Businessfeatures, sondern zentrale Betriebsdaten fuer Admins und Support.

Neue Tabellen:

- `SystemLog` fuer technische Ereignisse mit Level, Quelle, Message und Metadata.
- `ErrorLog` fuer Fehler mit Severity, Status, Stack, Metadata, Bearbeiter und Loesungsnotiz.
- `SystemHealthCheck` fuer Datenbank, Storage, Stripe, Google Maps, E-Mail und Queue.
- `BackgroundJobLog` fuer vorbereitete Worker-Laeufe wie Notification Queue, Accounting Export, PDF Generation, Stripe Webhook Processing und Report Generation.

### Health API

`GET /api/health` ist bewusst oeffentlich und minimal. Die Antwort enthaelt nur:

```json
{ "status": "OK" }
```

Details zu Datenbank, Storage, Stripe, Google Maps, E-Mail oder Queue bleiben ausschliesslich im Adminbereich.

### Admin Monitoring

Admin- und Supportrollen nutzen:

- `/admin/monitoring`
- `/admin/monitoring/errors`
- `/admin/monitoring/errors/:id`
- `GET /api/admin/monitoring`
- `GET /api/admin/monitoring/errors`
- `GET /api/admin/monitoring/errors/:id`
- `POST /api/admin/monitoring/errors/:id/resolve`
- `POST /api/admin/monitoring/errors/:id/ignore`
- `POST /api/admin/monitoring/health-check`

Das Dashboard zeigt Gesamtstatus, letzte Health Checks, offene kritische Fehler, Fehler nach Quelle, fehlgeschlagene Jobs sowie Status von Notification Queue, Stripe, Google Maps, Storage und Datenbank.

### Angebundene Fehlerpfade

Zentrale Fehlerlogs entstehen ueber `src/lib/monitoring.ts`. Angebunden sind:

- Stripe Webhook und Webhook Processing
- Payment Checkout und Mock-Zahlung
- PDF-/Report-/Invoice-Generierung ueber BackgroundJobLogs
- Accounting Export
- Notification Queue Fehler
- GPS Upload
- Lead Formular Fehler
- Warehouse Check-in Fehler
- globale App Error Boundary

### Beta-Betriebscheck

Vor einer Demo sollte ein Admin `/admin/monitoring` oeffnen und einen Health Check ausloesen. `DEGRADED` ist fuer lokale Beta-Umgebungen moeglich, wenn echte Provider-Keys fuer Stripe, Google Maps oder E-Mail fehlen. `DOWN` muss vor Kundendemo geklaert werden.

Test:

- `npm run test:module17` prueft Health API, Admin Monitoring, Errorliste, HealthCheck-Aktion, Resolve/Ignore, Seed-Daten, AuditLogs, Notifications und Migrationspraesenz.

## Modul 18: E-Mail-Versand, SMTP/Resend und Queue Worker

Modul 18 verbindet die bestehende Notification Queue mit echtem E-Mail-Versand. SMS, WhatsApp, Push und Newsletter-Marketing bleiben bewusst ausserhalb.

### ENV

```env
EMAIL_PROVIDER=mock
EMAIL_FROM=noreply@flyero.local
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
RESEND_API_KEY=
INTERNAL_API_TOKEN=
```

Provider:

- `mock`: Standard fuer Entwicklung und Tests. Es wird kein externer Versand ausgelöst, aber Queue, Logs, Audit und Monitoring verhalten sich wie bei echtem Versand.
- `smtp`: nutzt `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_USER`/`SMTP_PASS` und `SMTP_FROM` oder `EMAIL_FROM`.
- `resend`: vorbereitet ueber `RESEND_API_KEY` und `EMAIL_FROM`.

Keys werden nur serverseitig gelesen und nie im Frontend angezeigt.

### SMTP Setup

Für SMTP werden `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` und optional `SMTP_USER`/`SMTP_PASS` gesetzt. Port 465 nutzt TLS direkt, Port 587 nutzt automatisch STARTTLS, wenn der Provider es anbietet. In lokalen Demos bleibt `EMAIL_PROVIDER=mock` empfohlen.

### Queue Worker

`src/lib/notificationWorker.ts` verarbeitet `NotificationQueue` mit Kanal `EMAIL`.

Regeln:

- Maximal 50 E-Mails pro Lauf.
- Statusfluss: `PENDING` oder `RETRY` -> `SENDING` -> `SENT` oder `RETRY`/`FAILED`.
- Maximal 3 Versuche pro Queue-Eintrag.
- Danach bleibt der Status `FAILED`.

APIs:

- `GET /api/admin/notifications/queue`
- `POST /api/admin/notifications/queue/process`
- `POST /api/admin/notifications/queue/:id/retry`
- `POST /api/internal/notifications/process`
- `POST /api/admin/notifications/test-email`

Admin-Seite:

- `/admin/notifications/queue`

Die Seite zeigt wartende, gesendete und fehlgeschlagene E-Mails, Empfaenger, Template, Fehler, Retry-Button, Worker-Start und Test-E-Mail-Formular.

### Cron-Hinweis

Fuer Livebetrieb kann ein Cronjob oder externer Scheduler `POST /api/internal/notifications/process` mit Header `x-internal-token` aufrufen. Im MVP gibt es keinen dauerhaft laufenden Worker-Prozess.

Test:

- `npm run test:module18` prueft Mock Provider, Queue-Verarbeitung, Retry, Retry-Limit, Testmail API, Monitoring Logs, ENV-Key-Schutz und Datei-/Script-Praesenz.

## Modul 19: Analytics Dashboard, KPIs und CSV Export

Modul 19 ergänzt ein Admin-only Analytics Dashboard unter `/admin/analytics`.

### Analytics Dashboard

Die Seite zeigt Geschäftszahlen und operative Plattformaktivität:

- Umsatz gesamt und Umsatz aktueller Monat
- bezahlte und offene Aufträge
- abgeschlossene Touren
- neue Leads
- aktive Kunden und Verteiler
- offene Zahlungen, Refunds und veröffentlichte Reports

### KPIs

Die KPI-Logik liegt zentral in `src/lib/analytics.ts`. Pages und APIs rufen nur den Service auf.

Berechnet werden durchschnittliche Tourdauer, Strecke, GPS-Score, Auftrag → Zahlung, Zahlung → Adminfreigabe, Lagerzeit, Dispatchzeit, Tourabschluss → Bericht, Top-Kunden, wiederkehrende/inaktive Kunden und Verteilerleistung.

### Filter

Dashboard, APIs und CSV Export unterstützen Zeitraum, Stadt, Kunde, Verteiler und Status. Standard ist der Zeitraum der letzten 30 Tage.

### CSV Export

`GET /api/admin/analytics/export` exportiert die aktuellen Filterdaten als CSV.

Admin-APIs:

- `GET /api/admin/analytics`
- `GET /api/admin/analytics/revenue`
- `GET /api/admin/analytics/orders`
- `GET /api/admin/analytics/distributors`
- `GET /api/admin/analytics/export`

Audit Events:

- `analytics.viewed`
- `analytics.exported`

Test:

- `npm run test:module19` prüft Seite, KPIs, Filter, CSV Export, Rollenverbote und AuditLogs.

## Modul 20: CRM Pipeline und Lead-Nachverfolgung

Modul 20 ergänzt ein eigenes Mini-CRM für Beta-Vertrieb und Landingpage-Leads.

### CRM Pipeline

Admin und Support öffnen die Pipeline unter `/admin/crm`. Dort gibt es Kanban, Listenansicht, Suche sowie Filter nach Status, Priorität, Stadt und Lead-Typ.

Leadstatus:

- `NEW`
- `CONTACTED`
- `QUALIFIED`
- `OFFER_SENT`
- `TEST_ORDER_PLANNED`
- `WON`
- `LOST`
- `ARCHIVED`

Leadpriorität:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

### Lead-Detail

`/admin/crm/leads/[id]` zeigt Stammdaten, Nachricht, Quelle, Statushistorie, Notizen, Follow-ups und mögliche Auftragsmenge. Dort können Status, Priorität, Verantwortlicher, Follow-up-Datum, Potenzial und Notizen gepflegt werden.

### Follow-ups

`/admin/crm/followups` zeigt heute fällige, überfällige, diese Woche fällige und noch nicht terminierte Leads.

### Lead zu Kunde

Die Aktion „Als Kunde anlegen“ verknüpft einen gewonnenen Lead mit einer bestehenden Kunden-E-Mail oder legt ein vorbereitetes Kundenkonto mit unverifizierter E-Mail an. Doppelte E-Mails werden vermieden; `wonCustomerId` wird am Lead gespeichert.

### APIs

- `GET /api/admin/crm/leads`
- `GET /api/admin/crm/leads/:id`
- `PATCH /api/admin/crm/leads/:id`
- `POST /api/admin/crm/leads/:id/note`
- `POST /api/admin/crm/leads/:id/status`
- `POST /api/admin/crm/leads/:id/assign`
- `POST /api/admin/crm/leads/:id/convert`
- `GET /api/admin/crm/followups`

Analytics enthält zusätzlich Leads nach Status, Conversion Rate, neue Leads pro Woche, gewonnene Leads, verlorene Leads und offene Follow-ups. Admin-Notifications werden erzeugt für neue Leads, fällige Follow-ups, gewonnene Leads und verlorene Leads.

Test:

- `npm run test:module20` prüft CRM-Seiten, APIs, Statuswechsel, Notizen, Follow-ups, Conversion, Analytics, AuditLogs, Notifications, Lint und Build.

## Modul 21: Reklamationen, Support-Tickets und Qualit�tspr�fung

Modul 21 erg�nzt ein rollenbasiertes Support-System f�r Kunden, Verteiler und Admin/Support.

### Datenmodell

- `SupportTicket` enth�lt Ticketnummer, Typ, Status, Priorit�t, optionale Bez�ge zu Kunde, Verteiler, Auftrag, Tour, Report und Lagerbestand sowie Zuweisung, L�sung und Abschlusszeit.
- `TicketMessage` speichert �ffentliche Antworten und interne Notizen. Kunden und Verteiler sehen nur `PUBLIC`, Admin/Support sieht auch `INTERNAL`.
- `TicketAttachment` bereitet lokale/URL-basierte Anh�nge vor. Ein echter Upload-Provider ist im MVP noch nicht angebunden.
- `NumberingSettings` vergibt Ticketnummern im Format `FLY-TK-2026-000001`.

### Portale und APIs

- Admin: `/admin/support`, `/admin/support/tickets/[id]`, `/api/admin/support/tickets`
- Kunde: `/customer/support`, `/customer/support/tickets/[id]`, `/api/customer/support/tickets`
- Verteiler: `/distributor/support`, `/distributor/support/tickets/[id]`, `/api/distributor/support/tickets`

Kunden k�nnen Tickets zu Auftr�gen und Berichten erstellen. Im Kundenbericht erzeugt `Problem melden` ein Reklamationsticket mit Report-, Order- und Tourbezug. Verteiler k�nnen Tourprobleme melden. Admin/Support kann Status, Priorit�t, Verantwortlichen, �ffentliche Antworten, interne Notizen und Abschlussnotizen pflegen.

AuditEvents: `ticket.created`, `ticket.complaint_created`, `ticket.status_changed`, `ticket.priority_changed`, `ticket.assigned`, `ticket.message_added`, `ticket.closed`.

Analytics enth�lt offene Tickets, dringende Tickets, Reklamationen pro Monat, durchschnittliche L�sungszeit sowie Tickets nach Typ und Status.

Test:

- `npm run test:module21` pr�ft Ticketanlage, Report-Reklamation, Admin-Antwort, interne Notiz, Verteiler-Tourproblem, Schlie�en, Notifications, AuditLogs, Analytics und Rechtepr�fungen.

## Modul 22: Dokumentenmanagement, Uploads und Druckaufträge

Modul 22 ergänzt ein vollständiges DMS als Grundlage für den späteren End-to-End-Prozess von Druckdatei bis Verteilung.

### Dokumentenmanagement

- `Document` speichert Auftrag, Kunde, Typ, Originaldateiname, Storage-Key, Mime-Type, Dateigröße, Checksumme, Version, Status, Upload- und Freigabedaten.
- `DocumentVersion` hält jede neue Datei-Version revisionssicher fest.
- `DocumentComment` trennt öffentliche Kommentare von internen Prüfhinsweisen.
- `DocumentFolder` gruppiert Dokumente pro Auftrag.
- Kundenseiten: `/customer/documents` und `/customer/orders/[id]/documents`.
- Adminseite: `/admin/documents`.

Erlaubte Formate sind vorbereitet für PDF, ZIP, PNG, JPG, SVG, AI, INDD, DOCX, XLSX und PPTX. Die maximale Dateigröße wird über `DOCUMENT_MAX_FILE_SIZE_BYTES` gesteuert.

### Druckprozess

- `PrintOrder` bildet Format, Papier, Grammatur, Farbe, Veredelung, Falzung, Menge, Tracking, Status und spätere manuelle Preisfelder ab.
- `PrintPartner` verwaltet Druckpartner unter `/admin/print-partners`.
- Admin-Druckaufträge werden unter `/admin/print-orders` gepflegt.
- Kunden können Druck über `/customer/documents` anfragen.

Druckherstellungspreise werden nicht geraten oder hardcodiert. `PrintOrder.priceSnapshot`, `estimatedNetPrice` und `estimatedGrossPrice` sind vorbereitet, damit später echte FLYERO-Herstellpreise und Partnerkonditionen eingetragen werden.

### Lagerintegration

Wenn ein Druckauftrag auf `RECEIVED_IN_WAREHOUSE` oder `READY_FOR_DISTRIBUTION` gesetzt wird, legt das System bei Bedarf einen `WarehouseInventory`-Eintrag an bzw. aktualisiert ihn. Der Auftrag wechselt auf `READY_FOR_DISTRIBUTION`.

### APIs

- `GET/POST /api/customer/documents`
- `GET /api/customer/documents/:id`
- `GET /api/customer/documents/:id/download`
- `POST /api/customer/documents/:id/version`
- `GET/POST /api/customer/orders/:id/documents`
- `GET/PATCH /api/admin/documents/:id`
- `POST /api/admin/documents/:id/approve`
- `POST /api/admin/documents/:id/reject`
- `POST /api/admin/documents/:id/comment`
- `GET/POST /api/customer/print-orders`
- `GET /api/admin/print-orders`
- `PATCH /api/admin/print-orders/:id`
- `GET/POST /api/admin/print-partners`
- `PATCH /api/admin/print-partners/:id`

AuditEvents umfassen `document.uploaded`, `document.updated`, `document.approved`, `document.rejected`, `document.version_uploaded`, `print.requested`, `print.production_started`, `print.shipped` und `print.received`.

Test:

- `npm run test:module22` prüft Upload, Versionierung, Freigabe, Druckauftrag, Druckstatus, Lagerintegration, Rechte, Analytics, AuditLogs, Notifications, Migration, Seed, Lint und Build.

## Modul 23: Multi-Lager, Logistik und Supply Chain

Modul 23 erweitert FLYERO von einem regionalen Lagerprozess zu einer skalierbaren Multi-Standort-Logistik.

### Multi-Lager und Warehouse Regions

- `Warehouse` enthaelt jetzt Code, Land, Koordinaten, Region, Kapazitaetslimit, aktuelle Auslastung und interne Notizen.
- `WarehouseRegion` ordnet aktive Lager nach Stadt, PLZ-Praefixen, Radius und Prioritaet moeglichen Auftragsgebieten zu.
- `Order.assignedWarehouseId`, `warehouseAssignedAt` und `warehouseAssignmentReason` dokumentieren das zustaendige Lager und den Grund der Auswahl.
- Warehouse-User haben `User.warehouseId` und sehen im Lagerportal nur das zugewiesene Lager.

### Automatische Lagerzuweisung

`src/lib/logistics.ts` enthaelt `assignWarehouseForOrder`, `findBestWarehouseForArea`, `calculateWarehouseDistance`, `getWarehouseCapacityStatus`, `reserveWarehouseCapacity` und `releaseWarehouseCapacity`.

MVP-Regeln: aktive Region mit passender PLZ/Stadt gewinnt, bei mehreren Treffern gewinnt die hoechste Prioritaet, ohne Treffer wird das Default-Lager genutzt, inaktive Lager werden ignoriert und Kapazitaetswarnungen erzeugen AuditLog plus Admin-Notification.

### Sendungen, Umlagerungen und Inventur

- `LogisticsShipment` bildet Kundenlieferungen, Druckerei-zu-Lager, Lager-zu-Lager, Lager-zu-Verteiler, Ruecksendung und Entsorgung ab.
- `WarehouseTransfer` bildet Umlagerungen zwischen Lagern ab.
- `WarehouseStockCount` dokumentiert Inventurzaehlungen und Differenzen.
- Admin-Seiten: `/admin/logistics`, `/admin/logistics/warehouses/[id]`, `/admin/logistics/shipments`.
- Warehouse-Seiten: `/warehouse/shipments`, `/warehouse/transfers`, `/warehouse/stock-counts`.

### Druck- und Kundenlieferungsintegration

- Bei `PrintOrder`-Erstellung wird das zustaendige Lager bestimmt und eine `PRINTER_TO_WAREHOUSE`-Sendung vorbereitet.
- Druckstatus `SHIPPED`, `DELIVERED`, `RECEIVED_IN_WAREHOUSE` und `READY_FOR_DISTRIBUTION` synchronisieren die zugehoerige Logistiksendung.
- Bei Kundenauftraegen mit eigenen Flyern wird nach Zahlung/Adminfreigabe eine `CUSTOMER_TO_WAREHOUSE`-Sendung erstellt.
- Kunden sehen nur zustaendiges Lager, Lieferadresse, Auftragsnummer und Sendungsstatus, aber keine internen Kapazitaetsdaten.

### APIs

Admin: `/api/admin/logistics`, `/api/admin/logistics/warehouses`, `/api/admin/logistics/warehouses/:id`, `/api/admin/logistics/shipments`, `/api/admin/logistics/shipments/:id`, `/api/admin/logistics/transfers`, `/api/admin/logistics/transfers/:id`, `/api/admin/logistics/stock-counts`.

Warehouse: `/api/warehouse/shipments`, `/api/warehouse/shipments/:id`, `/api/warehouse/transfers`, `/api/warehouse/transfers/:id`, `/api/warehouse/stock-counts`.

Test: `npm run test:module23` prueft Multi-Lager-Seed, Regionen, Sendungen, beschaedigte/verspaetete Lieferungen, Umlagerungen, Inventur, Warehouse-Scope, Admin-Sicht, AuditLogs, Notifications und Analytics.
