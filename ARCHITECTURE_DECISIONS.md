# Architecture Decisions

## Modul 11: Rechnung nach Zahlung und Admin-Genehmigung

- Eine Rechnung entsteht erst nach Zahlung und Admin-Genehmigung, weil Flyero Vorkasse nutzt und der Auftrag fachlich erst nach der Pruefung angenommen ist.
- Die Rechnungserzeugung haengt am Statuswechsel `PAID_WAITING_FOR_ADMIN_REVIEW -> APPROVED`. Dadurch gibt es keine Rechnung fuer unbezahlte, fehlgeschlagene oder noch nicht freigegebene Auftraege.
- Die idempotente Rechnungserzeugung liegt in `createInvoiceForOrder`: Existiert bereits eine Rechnung fuer `orderId`, wird sie zurueckgegeben statt erneut erstellt. Das schuetzt gegen doppelte Klicks, wiederholte interne Aufrufe und spaetere Retry-Mechanismen.
- Trennung Payment/Invoice: `Payment` dokumentiert Stripe-Checkout, Webhook, Refund und Transaktionsreferenzen; `Invoice` dokumentiert steuerlich relevante Rechnungsdaten, Positionen und PDF.
- Rechnungspositionen sind strukturiert in `InvoiceItem` gespeichert. Das ist wichtig fuer Modul 12, damit Lexware/DATEV-Export nicht aus PDF-Text rekonstruiert werden muss.
- Rechnungs-PDFs sind abgeleitete Artefakte und liegen unter `public/generated/invoices`. Die Datenquelle bleibt die relationale Invoice-/InvoiceItem-Struktur.
- `CreditNote` ist vorbereitet, aber bewusst noch keine vollstaendige Buchhaltungslogik. Storno und Gutschrift werden als fachlicher Zustand vorbereitet, damit spaetere DATEV/Lexware-Exports sauber anschliessen koennen.

## Modul 10: Vorkasse, Stripe Checkout und Webhooks

- Flyero nutzt Vorkasse, weil interne Pruefung, Lager, Disposition und Verteilerkapazitaet erst nach gesicherter Zahlung belastet werden sollen. Neue Kundenauftraege starten deshalb in `PAYMENT_PENDING`.
- Stripe Checkout ist die einzige Zahlungsoberflaeche. Dadurch bleiben Kartendaten und Zahlungsformular ausserhalb der Plattform; Flyero speichert nur technische Referenzen, Status, Betrag, Waehrung und Auditdaten.
- Zahlungen werden nie durch Frontend-Ruecksprung bestaetigt. Erst ein gueltig signierter Stripe Webhook darf `Payment` auf `PAID` und `Order` auf `PAID_WAITING_FOR_ADMIN_REVIEW` setzen.
- `PaymentEvent.stripeEventId` ist eindeutig. Damit koennen doppelte Stripe-Webhooks idempotent verarbeitet werden, ohne doppelte Zahlungen, doppelte Statuswechsel oder doppelte Refunds zu erzeugen.
- Adminpruefung erst nach Zahlung: `PAID_WAITING_FOR_ADMIN_REVIEW` ist der fachliche Eingang in Genehmigung oder Ablehnung. Ohne Zahlung darf ein Auftrag nicht in Lager, Disposition oder Verteilerzuweisung laufen.
- Refunds sind Teil der Payment-Domain. Eine Admin-Ablehnung eines bezahlten Auftrags startet eine volle Rueckerstattung; `RefundType.PARTIAL` bereitet Teilrueckerstattungen fuer spaetere Bedienoberflaechen vor.
- Rechnungen bleiben vom Zahlungsprozess entkoppelt. Modul 11 kann steuerlich korrekte Rechnungen aus bestaetigten Zahlungsdaten erzeugen, ohne den Checkout- und Webhook-Fluss zu veraendern.

## Modul 9: ReportStatus, PDF-Berichte und Kundendatenschutz

- Verteilberichte liegen zentral im `Report`-Modell. `ReportStatus` trennt interne Entwuerfe (`DRAFT`), erzeugte Berichte (`GENERATED`), freigegebene Altdaten (`APPROVED`), veroeffentlichte Kundenberichte (`PUBLISHED`) und Archivierung (`ARCHIVED`).
- `ReportType` startet bewusst nur mit `DISTRIBUTION_PROOF`, damit spaetere Berichtstypen nicht mit Rechnungen, Auszahlungen oder Support-Dokumenten vermischt werden.
- `ReportTemplate` bereitet `STANDARD`, `IMMOBILIEN`, `RESTAURANT`, `FRANCHISE` und `CUSTOM_BRANDING` vor. Die fachliche PDF-/Online-Struktur bleibt gleich, Branding und Schwerpunkt koennen spaeter je Kundengruppe erweitert werden.
- Die Report-Domain liegt in `src/lib/reports.ts`. API-Routen, Adminseiten, Kundenseiten, PDF-Download und Verify-Endpunkt nutzen dieselbe Datensammlung, denselben GPS-Score und denselben Kundendatenschutzfilter.
- PDF-Dateien werden serverseitig erzeugt und unter `public/generated/reports` gespeichert. Die Datei enthaelt Berichtnummer, Pruefcode, Auftragsdaten, Kennzahlen, GPS-Qualitaet, Fotoanzahl, Kartenstatus und Checksumme.
- `GOOGLE_MAPS_SERVER_KEY` ist optional. Mit Key wird eine Static-Maps-URL vorbereitet, ohne Key erzeugt der Bericht keinen Fehler und dokumentiert den stabilen Karten-Fallback.
- Kundendatenschutz ist eine eigene Service-Schicht: Kunden sehen nur anonymisierte Verteilerkennung, GPS-Qualitaetslabel, Route, Fotonachweise und Berichtsdaten. Private Verteilerkontakte, Geburtsdatum, Adresse, interne Adminnotizen und rohe Fraud-Daten bleiben draussen.
- `verificationCode` und `checksum` sind fuer externe Pruefung vorbereitet. Der oeffentliche Verify-Endpunkt gibt nur reduzierte Metadaten aus und schreibt `report.verify_checked` ins AuditLog.
- Rechnungen, Stripe, Auszahlungen, Lexware/DATEV und Live-Tracking waehrend laufender Touren bleiben bewusst ausserhalb von Modul 9.

## Modul 8: DistributionArea, GeoJSON und Haushaltsberechnung

- Verteilgebiete werden in `DistributionArea` als fachliche Einheit gespeichert. Der Auftrag verweist optional ueber `distributionAreaId` darauf, behaelt aber Snapshot-Felder wie `targetAreaGeoJson`, Haushalte, Flyer, Strecke und Flaeche.
- GeoJSON `FeatureCollection` ist das primaere Geometrieformat. Es ist portabel fuer spaetere automatische Haushaltsberechnung, Preisermittlung, Auto-Dispatch, Routenoptimierung und Export.
- Einzelne Polygone werden zusaetzlich in `AreaPolygon` gespeichert. Dadurch koennen Mehrpolygon-Gebiete bearbeitet, sortiert und spaeter einzeln analysiert werden.
- `AreaHouseholdEstimate` trennt Schaetzung von Gebiet. Aktuell sind manuelle und Seed-Schaetzungen aktiv; `AUTOMATIC` und `IMPORT` sind fuer spaetere externe Haushaltsdaten vorbereitet.
- `AreaHistory` speichert fachliche Gebietsaenderungen getrennt vom globalen `AuditLog`. `AuditLog` bleibt fuer revisionsfaehige Plattformereignisse wie `area.created`, `area.updated`, `area.deleted` und `area.assigned` erhalten.
- `DistributionAreaEditor` nutzt Google Maps im Browser mit Drawing- und Geometry-Library. Ohne Browser-Key bleibt die Anwendung ueber Formularfelder und GeoJSON-Fallback nutzbar.
- `GOOGLE_MAPS_SERVER_KEY` bleibt serverseitig vorgesehen, wird in Modul 8 aber noch nicht fuer Geocoding, Static Maps oder automatische Flaechenberechnung genutzt.
- Straßenzuege, automatische Haushaltsdaten, Live Tracking, PDF, Rechnungen und Stripe bleiben bewusst ausserhalb dieses Moduls.

## Modul 7: Dispatch, Kapazitaet und Reservierung

- Dispatch liegt in `src/lib/dispatch.ts` als eigene Domain-Schicht. API-Routen, Adminseite und Verteiler-Dashboard nutzen dieselben Regeln fuer Empfehlungen, Kapazitaetswarnung, Annahme, Ablehnung und Reservierung.
- `DispatchAssignment` ist bewusst getrennt von `DistributionTour`. Eine Anfrage kann abgelehnt, storniert oder neu zugewiesen werden, ohne die Tourhistorie zu verfaelschen.
- Die feste Lagerreservierung passiert erst im Dispatch-Fluss: Bei Zuweisung wird der Bestand fuer den Verteiler reserviert, bei Annahme bleibt er exklusiv reserviert, bei Ablehnung wird er wieder auf `PREPARED` gesetzt.
- Kapazitaet wird am Verteilerprofil gespeichert (`maxToursPerDay`, `maxFlyersPerDay`, `currentAssignedFlyers`, `currentAssignedTours`, `availableToday`). Die aktuellen Werte werden aus aktiven DispatchAssignments und Touren synchronisiert.
- Die Empfehlung ist deterministisch und ohne externen Kartenanbieter. Distanz ist aktuell eine regionale Naeherung nach Stadt/Region, damit keine Google- oder Optimierungsabhaengigkeit in den Dispatch-Kern rutscht.
- Auto-Dispatch, KI-Empfehlung, Distanz-/Workload-Optimierung und bevorzugte Verteiler sind durch Score, Distanz, Status und AuditLog vorbereitet, aber noch nicht automatisiert.
- PDF-Berichte, Rechnungen, Stripe und Auszahlungen bleiben ausserhalb von Modul 7.

## Modul 6: Karten, RouteAnalysis und Berichtsvorschau

- Google Maps ist gekapselt in `RouteMap`. Ohne `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` rendert die App eine Koordinaten-Fallbackliste statt abzustuerzen.
- `GOOGLE_MAPS_SERVER_KEY` wird nur serverseitig fuer spaetere Static-Maps-Snapshots vorgesehen. Modul 6 erzeugt noch keine Kartenbilder.
- Route-Auswertung liegt in `src/lib/routeAnalysis.ts`, damit GPS-Bewertung, Flags und Kennzahlen nicht in UI-Komponenten dupliziert werden.
- `src/lib/mapSnapshot.ts` ist ein Stub fuer Modul 7. Er beschreibt die spaetere Static-Maps-Erzeugung, liefert aber bewusst noch kein Bild.

## Datenschutz Kundensicht

- Kunden sehen nur freigegebene Reports mit anonymisierter Verteilerkennung. Private Verteileradresse, Telefonnummer, E-Mail, Geburtsdatum, interne Notizen und rohe Admin-Daten bleiben aus der Kundenansicht heraus.
- Admins sehen GPS-Rohpunkte, Fotos, AuditLog, Statushistorie und interne Notizen fuer die Tourpruefung.
- PDF-Berichte, Rechnungen, Auszahlungen, Google Route Optimization und Live-Tracking fuer Kunden bleiben fuer spaetere Module ausgespart.
## Modul 12: Zentrale Settings

- Zentrale Settings ersetzen hartcodierte Firmen-, Branding-, Nummernkreis- und Systemwerte. Das bereitet Lexware/DATEV, mehrere Lager und White-Label-faehige Installationen vor.
- Keys nicht in DB: Stripe- und Google-Secrets bleiben in ENV, weil sie Betriebsgeheimnisse sind und nicht ueber Admin-UI, Backups oder Datenexports verteilt werden sollen. Das UI zeigt nur Konfigurationsstatus.
- Nummernkreise sind zentral, damit Rechnungs-, Berichts- und Auftragsnummern reproduzierbar, eindeutig und spaeter buchhalterisch kontrollierbar bleiben.
- Preislogik bleibt in `src/lib/pricing.ts`. Admin-Seiten und APIs verwalten nur `PricingSetting`/`PricingRule`, damit keine Preisformeln in UI-Komponenten dupliziert werden.
- Warehouse wird erweitert statt dupliziert: aktiv/inaktiv, Standardlager, Oeffnungszeiten und Ansprechpartner reichen fuer Modul 12 und vermeiden eine verfruehte Multi-Depot-Dispatch-Architektur.

## Modul 13: Accounting Export

- Export zuerst, API spaeter: Lexware/DATEV-Live-Schnittstellen werden bewusst noch nicht integriert. CSV-Exportlaeufe schaffen pruefbare Daten, Historie und Dateiartefakte, ohne externe Systeme oder Zugangsdaten in die Plattform zu ziehen.
- CSV bleibt generisch genug, damit Buchhaltung, Steuerberater und spaetere API-Adapter dieselbe Exportbasis nutzen koennen. Anbieterlogik wird im Service gekapselt, nicht in Pages oder APIs.
- DATEV muss mit Steuerberater geprueft werden, weil Kontenrahmen, Steuerschluessel, Debitorenlogik und Buchungstexte mandanten- und kanzleispezifisch sind. Das Modul liefert eine DATEV-nahe technische Struktur, keine steuerliche Endfreigabe.
- Das Modul veraendert keine Dispositionslogik, damit Modul 14 Auto-Dispatch sauber auf unveraenderter operativer Basis starten kann.

## Modul 14: Auto-Dispatch

- Auto-Dispatch ist im MVP regelbasiert und nicht KI-basiert. Dadurch bleiben Empfehlungen erklaerbar, reproduzierbar und auditierbar.
- Empfehlungen werden persistiert, damit Admins spaeter nachvollziehen koennen, warum ein Verteiler vorgeschlagen, ignoriert oder ausgewaehlt wurde.
- `autoDispatchEnabled` ist standardmaessig aus. Automatische Zuweisung passiert nur ab `autoDispatchMinScore`, damit der Admin die Funktion kontrolliert einfuehren kann.
- Gesperrte, pausierte oder nicht freigegebene Verteiler werden ausgeschlossen, damit Auto-Dispatch keine Review- oder Compliance-Regeln umgeht.
- Notifications werden ausgelöst, aber keine E-Mail-Templates gebaut. Modul 15 kann darauf sauber aufsetzen.
## Modul 15: Kommunikation und Notification-Service

- Alle Laufzeitmodule kommunizieren ueber `src/lib/notifications.ts`. Der Service schreibt die bisherige `Notification` weiter fuer Kompatibilitaet, erzeugt aber zusaetzlich `NotificationMessage`, `NotificationQueue` und `NotificationLog`.
- Versand ist Queue-first. Externe E-Mail-Provider werden im MVP nicht direkt angesprochen; ein spaeter Worker kann `PENDING` und `RETRY` Eintraege abarbeiten und `notification.sent` oder `notification.failed` protokollieren.
- `NotificationTemplate` speichert Vorlagen mit Zielgruppe, Kanal und Platzhaltern. Platzhalter bleiben textbasiert und erweiterbar, damit Modul 16 CRM/Analytics neue Kontextdaten nutzen kann, ohne sofort eine Migration zu brauchen.
- `NotificationPreference` wird pro User, Typ und Kanal gespeichert. Fehlt eine Preference, gilt die Nachricht als aktiv. Das verhindert harte Opt-out-Logik in Fachmodulen.
- WhatsApp, SMS und Push sind als `NotificationChannel` vorbereitet, aber ohne Provider-Anbindung. Keine Firebase-, SMS- oder WhatsApp-Integration in Modul 15.
- Jede wichtige Kommunikationsaktion wird sowohl in `NotificationLog` als auch im globalen `AuditLog` gespiegelt. Das schafft die Nachvollziehbarkeit fuer CRM, Analytics und Support-Recherche in Modul 16.

## Modul 16: Landingpage, Lead-Modell und rechtliche Seiten

- Die Landingpage kommt vor weiteren Marketingfeatures, weil FLYERO fuer Beta-Demos einen oeffentlichen Einstieg braucht. Blog, CMS, Ads, Analytics und Monitoring bleiben bewusst ausserhalb dieses Moduls.
- Die Marketingseiten sind statische Next.js-Seiten mit gemeinsamen Komponenten. Dadurch bleibt die Beta stabil und braucht keine zusaetzliche Content-Infrastruktur.
- Das Kontaktformular schreibt in ein echtes `Lead`-Modell statt nur eine E-Mail oder Logzeile zu erzeugen. So koennen Admins Status, Notiz, Quelle und Archivierung nachvollziehbar pflegen.
- `LeadType` und `LeadStatus` sind Enums, damit Auswertungen und spaetere CRM-/Sales-Funktionen auf sauberen Zustandswerten aufbauen koennen.
- `adminNote` und `archivedAt` ergaenzen das vom Prompt geforderte Lead-Modell, weil Admin-Seite und operative Bearbeitung sonst keine Notiz- oder Archivfunktion haetten.
- Lead-Erstellung erzeugt `lead.created` im AuditLog und eine Admin-Notification `LEAD_CREATED`. Marketing-Leads werden dadurch wie operative Ereignisse nachvollziehbar.
- Admin-Leads sind fuer `ADMIN` und `SUPPORT_DISPATCHER` freigegeben, weil Support/Dispatcher in diesem MVP bereits interne Admin-Aufgaben uebernimmt.
- Rechtliche Seiten sind bewusst Platzhalter. Impressum, Datenschutz und AGB duerfen vor echtem Kundenbetrieb nicht als finale Rechtstexte verstanden werden und muessen extern geprueft werden.
- CTA-Verlinkungen nutzen bestehende Routen: Auftragserstellung unter `/customer/orders/new`, Verteilerregistrierung unter `/register/distributor`, Login unter `/login`.
- Nach Modul 16 sollte Modul 17 Monitoring, Fehlerlogs und Betriebssicherheit priorisieren. Weitere Marketingmodule wuerden vor Monitoring die operative Beta-Reife weniger stark verbessern.

## Modul 17: Monitoring, Fehlerlogs und Betriebssicherheit

- Monitoring kommt vor weiteren Features, weil die Plattform ab Beta nicht nur funktionieren, sondern im Fehlerfall nachvollziehbar betreibbar sein muss. Ohne zentrale Health Checks und Fehlerlogs waeren Stripe, PDF, Lager, GPS, Reports und Notifications schwer zu debuggen.
- `GET /api/health` bleibt oeffentlich, aber minimal. Externe Uptime-Checks brauchen nur `OK`, `DEGRADED` oder `DOWN`; Details zu Datenbank, Storage, Stripe, Google Maps, E-Mail und Queue wuerden Angriffs- und Betriebsinformationen leaken.
- Detailinformationen liegen ausschliesslich hinter Admin-/Support-Rollen unter `/admin/monitoring`. Damit koennen interne Nutzer Probleme sehen, ohne dass sensible Infrastrukturdetails oeffentlich werden.
- Fehlerlogs werden zentral ueber `src/lib/monitoring.ts` erzeugt statt verstreut per `console.error`. Dadurch entstehen einheitliche Severity, Status, Quelle, Metadata, AuditLog und Notifications.
- `BackgroundJobLog` wird schon eingefuehrt, obwohl noch kein echter Worker existiert. PDF-Generierung, Accounting Export, Stripe Webhook Processing, Report Generation und Notification Queue koennen spaeter ohne neues Datenmodell in Worker ausgelagert werden.
- Error Boundaries zeigen keine Stacktraces im Frontend. Stack und Metadata sind Admin-Diagnosedaten und bleiben im geschuetzten Monitoringbereich.
- Health Checks bewerten Provider-Konfigurationen lokal als `DEGRADED`, wenn Keys fehlen. Das ist fuer Beta sinnvoll, weil lokale Demo-Umgebungen nicht zwingend echte Stripe-, Google- oder E-Mail-Provider verwenden.
- Monitoring erzeugt eigene AuditEvents (`monitoring.health_checked`, `monitoring.error_created`, `monitoring.error_resolved`, `monitoring.error_ignored`, `monitoring.job_failed`), damit Betriebsentscheidungen spaeter nachvollziehbar bleiben.

## Modul 18: E-Mail-Versand und Notification Queue Worker

- Queue statt Direktversand: E-Mails werden zuerst persistiert und danach kontrolliert verarbeitet.
- E-Mails werden ueber `NotificationQueue` versendet statt direkt im Businessprozess. Dadurch blockieren Registrierung, Zahlung, Bericht oder Dispatch nicht, wenn ein Provider langsam oder gestoert ist.
- Der Worker ist als Service `src/lib/notificationWorker.ts` gekapselt. APIs und Adminseiten starten nur Verarbeitung oder Retry, enthalten aber keine Versandlogik.
- Der Mock Provider ist Standard fuer Development und Tests. So koennen Queue, Logs, Monitoring und Audit realistisch geprueft werden, ohne echte Empfaenger oder externe Provider zu belasten.
- SMTP wird ohne Frontend-Beruehrung rein serverseitig ueber ENV konfiguriert. Resend ist vorbereitet, aber ebenfalls serverseitig gekapselt.
- Rate Limit und Retry-Limit sind MVP-Sicherheitsbremsen: maximal 50 Mails pro Lauf, maximal 3 Versuche pro Queue-Eintrag. Das verhindert Massenversand durch defekte Templates, falsche Cronfrequenz oder Providerfehler.
- Testmail ist Admin-only und erzeugt `email.test_sent`, damit auch manuelle Versandpruefungen auditierbar bleiben.
- Worker-Laeufe schreiben `BackgroundJobLog`, `SystemLog`, `NotificationLog`, `AuditLog` und bei Fehlern `ErrorLog`. Dadurch fuegt sich Versand in das Monitoring aus Modul 17 ein.

## Modul 19: Analytics, Business Dashboard und KPI-Auswertung

- Analytics nutzt zentrale Analytics Services in `src/lib/analytics.ts`. Pages und APIs enthalten keine eigene KPI-Logik, sondern nur Auth, Filterübergabe und Darstellung. Dadurch bleiben Berechnungen konsistent zwischen Dashboard, API und CSV Export.
- Das MVP verzichtet bewusst auf externes BI, Data Warehouse und KI-Prognosen. Die Plattform ist noch operativ im Aufbau; ein direktes Read-Modell aus den bestehenden Tabellen ist einfacher prüfbar, schneller iterierbar und reduziert Infrastrukturkomplexität.
- KPIs werden aus operativen Tabellen berechnet: `Order`, `Payment`, `Refund`, `DistributionTour`, `GpsPoint`, `WarehouseInventory`, `DispatchAssignment`, `Report`, `Lead`, `CustomerProfile` und `DistributorProfile`. So entsprechen die Zahlen dem tatsächlichen Plattformzustand.
- CSV Export ist ein einfacher Admin-only Export der aktuellen Filterdaten. Dadurch können Beta-Auswertungen extern weiterverarbeitet werden, ohne ein neues Reporting-Modul oder externe BI-Anbindung einzuführen.
- `analytics.viewed` und `analytics.exported` werden als AuditLogs geschrieben, damit Management- und Exportzugriffe nachvollziehbar bleiben.

## Modul 20: Mini-CRM, Leadpipeline und vorbereitete Conversion

- FLYERO nutzt im MVP ein eigenes Mini-CRM statt einer externen CRM-Integration. Die Plattform sammelt Leads bereits selbst über Landingpage und Kontaktformulare; ein internes CRM hält Daten, Rollenrechte, AuditLogs und Demo-Seed nah am bestehenden System.
- Die Entscheidung gegen externe CRM-Integration gilt für das MVP, damit Beta-Vertrieb, Datenschutz und Auditierbarkeit zuerst im eigenen System stabil sind.
- Externe CRM-Integration wird bewusst verschoben. Für die Beta sind Pipeline, Follow-ups, Verantwortliche und Statushistorie wichtiger als Synchronisation mit HubSpot, Pipedrive oder Newsletter-Tools. Dadurch bleiben Datenschutz, Betrieb und Fehleranalyse einfacher.
- Lead-Aktivitäten liegen in `LeadActivity`, Gesprächsnotizen in `LeadNote`. So bleiben Statuswechsel, Follow-ups, Zuweisungen und Notizen nachvollziehbar, ohne das `Lead`-Modell mit historisierten Textfeldern zu überladen.
- Conversion wird vorbereitet statt voll automatisiert verkauft: Ein gewonnener Lead wird mit einem bestehenden Kunden verknüpft oder als unverifiziertes Kundenkonto angelegt. Dadurch wird `wonCustomerId` gespeichert, aber der Kunde muss sein Konto weiterhin sauber verifizieren.
- CRM-APIs sind admin- bzw. supportbeschränkt. Customer, Distributor und Warehouse erhalten keinen Zugriff auf Leadpipeline oder Vertriebsnotizen.
- Analytics liest CRM-Daten direkt aus `Lead`, `LeadNote` und `LeadActivity`, weil für die Beta keine separate BI-Schicht nötig ist.

## Modul 21: Support-Tickets und Reklamationen

- Support wird als Plattformkern modelliert, nicht als Kontaktformular. Dadurch bleiben Reklamationen, Tourprobleme, Lagerf�lle und Abrechnungskl�rungen auditierbar und rollenbeschr�nkt.
- `SupportTicket` bleibt das zentrale Objekt und wird erweitert, statt ein zweites Complaint-Modell einzuf�hren. Ein Ticket kann �ber `TicketType.COMPLAINT` eindeutig als Reklamation erkannt werden.
- `TicketMessage.visibility` trennt �ffentliche Kommunikation von internen Notizen. Diese Trennung ist wichtiger als separate Tabellen, weil Admins im selben Verlauf arbeiten, Kunden und Verteiler aber keine internen Pr�fhinweise sehen d�rfen.
- Kunden d�rfen nur eigene Auftr�ge und Berichte verkn�pfen. Verteiler d�rfen nur eigene Touren verkn�pfen. Admin und Support d�rfen den vollst�ndigen Kontext inklusive interner Verteileridentifikation sehen.
- Ticketnummern nutzen `NumberingSettings`, damit Rechnungen, Reports, Auftr�ge und Supportf�lle einheitlich nachvollziehbare Nummernkreise haben.
- Anh�nge sind im MVP datenmodellseitig vorbereitet. Ein produktiver Datei-Upload braucht sp�ter Storage, Virenscan, Gr��enlimits und Berechtigungspr�fung pro Download.
- Analytics liest Support-KPIs direkt aus `SupportTicket`, weil f�r die Beta keine separate Case-Management-Auswertung n�tig ist.

## Modul 22: DMS, Datei-Storage und Druckmodul

- FLYERO braucht ein echtes Dokumentenmanagement, weil Druckdateien, Versionen, Freigaben, Rechnungen, Berichte und Reklamationsbelege langfristig unterschiedliche Lebenszyklen haben. Ein einzelnes Upload-Feld am Auftrag wäre nicht auditierbar genug.
- Versionierung liegt in `DocumentVersion`, während `Document` immer auf die aktuelle Version zeigt. Dadurch bleiben alte Druckdateien erhalten, ohne Kunden- und Adminseiten kompliziert zu machen.
- Kommentare haben `PUBLIC` und `INTERNAL`, damit Kunden klare Freigabehinweise sehen, Admins aber interne Qualitätsnotizen führen können.
- Storage ist über `src/lib/documentStorage.ts` gekapselt. Das lokale Dateisystem ist nur der MVP-Adapter; S3, Cloudflare R2 oder Azure Blob können später hinter derselben Service-Grenze eingebaut werden.
- Downloads laufen über geschützte API-Routen statt öffentliche Datei-URLs. Damit bleiben Kundendokumente, Druckdateien und Verträge rollenbeschränkt.
- Das Druckmodul ist getrennt von der Verteilpreislogik. Druckherstellungspreise werden nicht geraten; `estimatedNetPrice`, `estimatedGrossPrice` und `priceSnapshot` sind für echte FLYERO-Konditionen vorbereitet.
- `PrintPartner` ist eigenständig, weil Modul 23 mehrere Lager und optimale Druck-/Logistikwege vorbereiten soll. Druckaufträge sind daher nicht hart auf ein Lager verdrahtet, können aber bei Wareneingang mit `WarehouseInventory` verknüpft werden.
- Der Status `RECEIVED_IN_WAREHOUSE` erzeugt bzw. aktualisiert Lagerbestand und setzt den Auftrag auf `READY_FOR_DISTRIBUTION`. So entsteht der Übergang vom Druckprozess in Lager und Dispatch ohne manuelle Doppelpflege.

## Modul 23: Multi-Lager und Logistik-MVP

- `WarehouseRegion` ist eine eigene Tabelle, weil Lagerzustaendigkeit nicht dauerhaft hart am Lager oder Auftrag gepflegt werden soll. Regionen erlauben spaetere automatische Optimierung ueber PLZ, Stadt, Radius oder Polygon, ohne bestehende Auftraege umzubauen.
- `LogisticsShipment` ist das gemeinsame Sendungsmodell fuer Kundenlieferung, Druckerei-zu-Lager, Umlagerung, Verteileruebergabe, Ruecksendung und Entsorgung. Dadurch bleibt Tracking/Audit einheitlich, auch wenn spaeter Carrier-APIs ergaenzt werden.
- `WarehouseTransfer` bleibt von `LogisticsShipment` getrennt, weil Umlagerungen interne Freigabe-, Mengen- und Empfangsprozesse haben. Eine Sendung beschreibt Transportstatus, ein Transfer beschreibt die operative Bestandsbewegung.
- `WarehouseInventory` bleibt lagerbezogen und bekommt `warehouseId` zusaetzlich zum Lagerplatz. Der Lagerplatz kann wechseln oder fehlen, das zustaendige Lager muss trotzdem eindeutig bleiben.
- `User.warehouseId` bindet Warehouse-Staff an ein Lager. Admin/Support behalten Gesamtsicht, Warehouse-User erhalten serverseitige Scopes auf eigenes Lager, Sendungen, Transfers und Inventur.
- Kunden sehen nur Lieferadresse und Sendungsstatus des zustaendigen Lagers. Kapazitaetslimit, Auslastung, Umlagerungen und interne Notizen bleiben Admin-/Warehouse-Daten.
- Es gibt bewusst noch keine externe Carrier-API. Im MVP sind Carrier und Trackingnummer manuell, damit Rechte, AuditLogs, Prozesse und Datenmodell stabil werden, bevor DHL/DPD/GLS-Integrationen technische Komplexitaet hinzufuegen.
- Routenoptimierung, KI-Optimierung, Franchise/White-Label und native Apps bleiben ausserhalb von Modul 23. Modul 23 schafft nur die Logistikdatenbasis fuer Modul 24.

## Modul 24: UX-first Auftragserstellung und Smart Maps

### Entscheidung

Die Auftragserstellung wird als Kartenplanung modelliert, nicht als klassischer Formular-Wizard. Die Karte ist das Zentrum des Prozesses; Eingaben sind nur noch Steuerflächen für Ort, Gebiet, Menge und Termin.

### Warum UX-first?

Der Kunde soll nicht verstehen müssen, wie FLYERO intern Aufträge, Gebiete, Lager und Disposition organisiert. Er soll nur sagen: Wo verteilen? Welches Gebiet? Wann? Der Rest wird live vorgeschlagen oder berechnet.

### Warum Karten im Mittelpunkt stehen

Flyerverteilung ist räumlich. Eine große Karte reduziert Denkaufwand, zeigt Gebiet, Route, Heatmap und Grenzen direkt im Kontext und spart Klicks gegenüber separaten Formularschritten.

### Warum Live-Berechnungen

Preis, Haushalte, Flyer, Laufstrecke, Laufzeit, Lager und Verteilerbedarf werden sofort angezeigt. Dadurch entfällt die alte Zusammenfassungslogik als separater Schritt und der Nutzer bekommt direkte Sicherheit.

### Warum Service Layer

Routing, Autocomplete, Geocoding, Heatmap und Tourkombinationen liegen in `src/lib/routing.ts` und `src/lib/smartMaps.ts`. React-Komponenten bleiben zustands- und darstellungsorientiert. Google-REST-Aufrufe bleiben serverseitig vorbereitet.

### Warum weniger Klicks wichtiger sind als mehr Funktionen

Modul 24 erweitert nicht primär Businessmodule, sondern reduziert Reibung: Vorschläge während der Eingabe, automatischer Kartensprung, gespeicherte Gebiete, Live Business Card, Undo/Redo im Polygon und direkte Buchung aus derselben Oberfläche.

### Offene Produktionspunkte

- Echte Google Places-/Geocoding-Billing-Konfiguration muss mit produktiven Keys geprüft werden.
- Route Optimization API kann später statt der aktuellen Cluster-/Fallbacklogik angeschlossen werden.
- Browserbasierte Drag-Gesten für einzelne Polygonpunkte können weiter ausgebaut werden; aktuell sind Punktsteuerung, Hinzufügen, Löschen, Verschieben, Undo und Redo verfügbar.
