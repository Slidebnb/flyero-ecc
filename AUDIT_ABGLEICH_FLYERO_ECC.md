# Vollstaendiger Audit-Abgleich Flyero ECC

Stand: 2026-07-03

> Historischer Auditstand. Der aktuelle, vollstaendige CTO-, Sicherheits- und Due-Diligence-Abgleich vom 12.07.2026 steht in `TECHNICAL_DUE_DILIGENCE_AUDIT_2026-07-12.md`. Aussagen in diesem Dokument koennen durch spaetere Haertungen ueberholt sein.

Ziel dieses Dokuments ist ein CTO-orientierter Vollabgleich der schonungslosen Audit-Analyse gegen den tatsaechlichen Repo-Stand in `C:\Users\Administrator\ecc`. Das Ergebnis kombiniert:

1. eine Befundmatrix pro Audit-These
2. eine priorisierte Haertungs- und Launch-Reihenfolge

Es werden nur nachpruefbare Repo-Fakten, bestehende Projektdokumente und verifizierte Checks verwendet. Keine Vermarktungsrhetorik, keine Beschwichtigung.

## Executive Summary

Das Audit ist in seiner Grundrichtung ueberwiegend zutreffend. Das Projekt ist kein blosses Landingpage-Prototyp, sondern ein fachlich breiter Monolith mit echten Betriebsmodellen fuer Orders, Payments, Invoices, Reports, Lager, Dispatch, Touren, CRM, Monitoring und Dokumente. Gleichzeitig ist die Produktionsreife sichtbar hinter der fachlichen Breite zurueck.

Die groessten bestaetigten Risiken liegen in drei Bereichen:

- **Launch- und Trust-Kette**: Eine kundenaufrufbare Mock-Complete-Route vervollstaendigt Zahlungen serverseitig ausserhalb des Stripe-Webhooks.
- **Artefakt- und Proof-Integritaet**: Relevante PDFs liegen unter `public/generated/*`, und Tour-Fotos akzeptieren freie `url` oder `imageDataUrl`.
- **Oeffentliche Angriffsflaechen und Betriebswahrheit**: `POST /api/leads` zeigt keinen sichtbaren Abuse-Schutz, und die Health-/Google-Maps-Konfiguration ist inkonsistent dokumentiert bzw. implementiert.

Die vorhandene Projektdoku stuetzt die gleiche Gesamtaussage: kontrollierte Beta ja, offener Launch nein. Das ist konsistent mit `BETA_RELEASE_CHECKLIST.md`, `KNOWN_ISSUES.md`, dem Code der Zahlungs-, Dokumenten-, Monitoring- und Tour-Pfade sowie den aktuellen Build-/Lint-Checks.

## Befundmatrix

Legende:

- **Status**: bestaetigt / teilweise bestaetigt / nicht bestaetigt
- **Risiko**: Blocker / hoch / mittel / niedrig

### 1) Payments / Revenue-Kette

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Nur der signierte Stripe-Webhook sollte Zahlungen final auf `PAID` setzen, der aktuelle Stand unterlaeuft diese Regel teilweise. | `src/app/api/stripe/webhook/route.ts` verarbeitet signierte Webhooks serverseitig. `src/app/api/payments/mock-complete/[id]/route.ts` bleibt fuer kontrollierte Nicht-Production-Tests vorhanden, wird in Production jetzt aber auch bei falsch gesetztem `ENABLE_MOCK_PAYMENTS=true` hart mit 404 blockiert. | bestaetigt | Blocker | Mock-Completion vor offenem Launch entfernen oder hart an expliziten Non-Production-Mode binden; der Production-Guard ist umgesetzt, die Live-Stripe-Abnahme bleibt offen. | 1 |
| Das Projekt ist fuer lokale/Test-Zahlungen vorbereitet, aber nicht als durchgehend gehaerteter Live-Stripe-Betrieb zu werten. | `BETA_RELEASE_CHECKLIST.md` nennt explizit offenen Live-Checkout-/Webhook-Pruefbedarf. `KNOWN_ISSUES.md` beschreibt lokalen Mock-Checkout und separat zu testenden echten Webhook. | bestaetigt | hoch | Revenue-Kette auf Live-Stripe, Fehlerfaelle und Webhook-Wiederholungen begrenzen und systematisch testen. | 1 |
| Monetarisierung ist transaktionsbasiert und kein ausgearbeitetes Subscription-SaaS-Modell. | `package.json` und die gesichteten Zahlungsrouten zeigen Stripe Checkout im Payment-Kontext; in Doku und Code ist kein Subscription-/Plan-/Usage-System sichtbar. | bestaetigt | niedrig | Nach Launch-Fokus nicht als Akutrisiko behandeln, sondern nur fuer Spaeter-Narrativ dokumentieren. | 5 |

### 2) Dokumente / Artefakte / Storage

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Rechnungs- und Report-PDFs liegen oeffentlich bzw. vorhersagbar unter `public/generated/*`. | `src/lib/invoices.ts` schreibt PDFs nach `public/generated/invoices` und setzt `pdfUrl` auf `/generated/invoices/<nummer>.pdf`. `README.md` dokumentiert `/public/generated/invoices` und `/public/generated/reports`. | bestaetigt | Blocker | Revisionsrelevante Artefakte aus `public/generated/*` herausnehmen und nur ueber autorisierte Download-Routen ausliefern. | 1 |
| Dokumente werden standardmaessig lokal im Dateisystem gespeichert, nicht in einem produktionsreifen Objekt-Storage. | `src/lib/documentStorage.ts` nutzt `storage/documents` oder `DOCUMENT_STORAGE_ROOT`; `KNOWN_ISSUES.md` und `BETA_RELEASE_CHECKLIST.md` nennen Backup-/Restore- und Produktionspruefbedarf. | bestaetigt | hoch | Dokumente mittelfristig in privaten Storage mit sauberem Zugriff, Backup und Integritaetsstrategie ueberfuehren. | 2 |
| Die aktuelle PDF-Erzeugung ist MVP-nah und vor Produktion fachlich/rechtlich nicht ausreichend freigegeben. | `KNOWN_ISSUES.md` bezeichnet PDF-Erzeugung als MVP-nah. `BETA_RELEASE_CHECKLIST.md` fordert fachliche/fiskalische PDF-Pruefung vor echtem Kundenbetrieb. | bestaetigt | hoch | Layout, Inhalte, Rechnungsrecht und Aufbewahrung vor Livebetrieb gesondert freigeben. | 2 |

### 3) Proof- / Foto-Integritaet

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Tour-Fotobeweise akzeptieren freie `url` oder `imageDataUrl` statt ausschliesslich kontrollierter Upload-Artefakte. | `src/lib/validators.ts` erlaubt `imageDataUrl` oder `url`. `src/lib/tours.ts` speichert `url: input.url ?? input.imageDataUrl ?? ""` direkt in `PhotoProof.url`. | bestaetigt | Blocker | Proof-Daten nur noch ueber kontrollierten Uploadpfad mit serverseitiger Speicherung, Metadaten und Herkunftsnachweis annehmen. | 1 |
| Das Produktversprechen "nachweisbare Flyerverteilung" ist fachlich staerker als die aktuelle Integritaet der Beweisoberflaeche. | Marketing-/README-Positionierung ist stark; der technische Nachweispfad bleibt aber aktuell locker ueber freie URL/Data-URL. | teilweise bestaetigt | hoch | Beweiskette mit Upload-Artefakten, Metadaten, Zugriffsschutz und Aufbewahrungsregeln haerten. | 1 |
| GPS-/Foto-Themen sind rechtlich und operativ noch nicht produktionsfertig geregelt. | `KNOWN_ISSUES.md` und `BETA_RELEASE_CHECKLIST.md` nennen Einwilligung, Aufbewahrung und Datenschutz fuer GPS/Fotos explizit als offen. | bestaetigt | hoch | Fach- und Rechtsfreigabe zusammen mit technischer Haertung behandeln. | 2 |

### 4) Oeffentliche Angriffsflaechen / Abuse

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| `POST /api/leads` zeigt im sichtbaren Code keinen Rate-Limit-, CAPTCHA- oder Honeypot-Schutz. | `src/app/api/leads/route.ts` validiert und erstellt Leads, erzeugt aber keinen sichtbaren Abuse-Schutz. `src/app/LeadForm.tsx` sendet direkt an `/api/leads`. | bestaetigt | hoch | Oeffentliche Lead- und aehnliche Auth-/Kontakt-Endpunkte mit Abuse-Schutz ergaenzen. | 2 |
| Oeffentliche Formulare koennen operative Last erzeugen, weil sie direkt Logs und Notifications ausloesen. | `src/lib/leads.ts` erstellt Lead, LeadActivity, AuditLog und Admin-Notification. | bestaetigt | mittel | Abuse-Schutz mit operativem Rate-Limit und Monitoring verknuepfen. | 2 |
| Eine offene Spam-/Missbrauchsoberflaeche ist aktuell eher ein Produktions- als ein Beta-Thema. | Fuer kontrollierte Beta tolerierbar, fuer oeffentlichen Launch ungenuegend. | teilweise bestaetigt | mittel | Fuer kontrollierte Beta dokumentieren, vor offenem Traffic schliessen. | 2 |

### 5) Health / Monitoring / ENV-Konsistenz

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Der oeffentliche Health-Endpoint haengt derzeit an der Datenbank und ist nicht fail-safe minimal. | `src/app/api/health/route.ts` liest `prisma.systemHealthCheck.findFirst(...)` und antwortet erst danach. Die README beschreibt `GET /api/health` aber als bewusst minimal mit nur `{ "status": "OK" }`. | bestaetigt | hoch | Health-Endpoint so umbauen, dass er bei DB-Ausfall kontrolliert und minimal antworten kann. | 3 |
| Google-Maps-Konfiguration ist zwischen Doku und Monitoring inkonsistent. | `src/lib/monitoring.ts` prueft `GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_SERVER_KEY`; Doku, `BETA_RELEASE_CHECKLIST.md`, `README.md`, `settings.ts` und die Frontend-Maps arbeiten mit `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` plus `GOOGLE_MAPS_SERVER_KEY`. | bestaetigt | mittel | ENV-Wahrheit vereinheitlichen und Monitoring auf dieselben produktiven Key-Namen ausrichten. | 3 |
| Monitoring ist vorhanden, aber kein belastbarer Produktionsbeweis fuer durchgaengigen Betrieb. | Es gibt `src/lib/monitoring.ts`, Health-Checks und Admin-Monitoring-Seiten. Gleichzeitig nennen `KNOWN_ISSUES.md` und `BETA_RELEASE_CHECKLIST.md` explizit fehlende Produktionschecks, Queue-/Webhook-/Export-Absicherung und Monitoring-Ausbau. | teilweise bestaetigt | mittel | Monitoring nicht als abgeschlossen darstellen; nur als Basis mit offenem Betriebsbedarf. | 3 |

### 6) Betriebsreife / manuelle Prozesse

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Die Plattform bildet viele Betriebsablaeufe ab, aber mehrere Kernschritte bleiben manuell. | `BETA_RELEASE_CHECKLIST.md` nennt manuelle Admin-Pruefung, Lagerstatus, Dispatch, Tourpruefung, Accounting-Export und Queue-Bearbeitung. | bestaetigt | hoch | Vor offenem Launch den manuellen Betriebsumfang ehrlich als Kapazitaetsgrenze behandeln. | 4 |
| Das Projekt ist laut eigener Doku fuer kontrollierte Beta geeignet, nicht fuer breiten Live-Kundenbetrieb. | `BETA_RELEASE_CHECKLIST.md` formuliert genau diese Einschraenkung; `KNOWN_ISSUES.md` stuetzt sie. | bestaetigt | hoch | Diese Linie in Produkt- und Launchentscheidung explizit beibehalten. | 4 |
| Die bestehende Smoke-Test-Landschaft ist ein gutes Signal, aber kein Beweis fuer Produktionshaertung. | `package.json` zeigt viele Modul-Smokes und `test:beta`; gleichzeitig bestehen bekannte Live-Luecken laut Doku weiter. | teilweise bestaetigt | mittel | Tests als technisches Sicherheitsnetz nutzen, nicht als Freifahrtschein fuer offenen Launch. | 4 |

### 7) Scope / Produktfokus / Modulbreite

| Audit-These | Repo-Nachweis | Status | Risiko | Massnahme | Reihenfolge |
| --- | --- | --- | --- | --- | --- |
| Das Repo ist fachlich deutlich breiter als ein Landingpage- oder simples MVP-Projekt. | README, Prisma-Schema, Admin-/Customer-/Warehouse-/Distributor-/CRM-/Monitoring-/Maps-Pfade und Test-Skripte belegen eine breite Betriebsplattform. | bestaetigt | mittel | Nach aussen nicht als "alles fertig" kommunizieren; intern Komplexitaet anerkennen. | 5 |
| Die groesste strategische Gefahr ist Scope-Drift vor Revenue-Haertung. | Die Breite der Module ist real; gleichzeitig dokumentieren `KNOWN_ISSUES.md` und `BETA_RELEASE_CHECKLIST.md` offene Produktionsluecken im Kernprozess. | bestaetigt | hoch | Kernpfad Auftrag -> Zahlung -> Freigabe -> Ausfuehrung -> Bericht/Rechnung priorisieren, Module 2. Ordnung nach hinten schieben. | 4 |
| Einige spaetere Module sind eher Version-2-Stoff als Launch-Voraussetzung. | `KNOWN_ISSUES.md` listet u. a. erweiterte Karten-/Routingdaten, Live-Tracking, Auszahlungen, DATEV/Lexware-Live-Schnittstellen und E-Mail-Worker als spaeter/offen. | bestaetigt | mittel | Nicht vor Revenue-, Artefakt- und Abuse-Haertung priorisieren. | 5 |

## Priorisierte Haertungsroadmap

### 1. Sofort blockierend vor offenem Launch

Diese Punkte sollten als harte Launch-Blocker behandelt werden:

1. `src/app/api/payments/mock-complete/[id]/route.ts` entfernen oder streng an expliziten Mock-/Non-Production-Mode binden.
2. Rechnungs- und Report-PDFs aus `public/generated/invoices` und `public/generated/reports` herausnehmen.
3. Tour-Fotos nicht mehr ueber freie `url` oder rohe `imageDataUrl` als produktive Proof-Quelle akzeptieren.

### 2. Vor oeffentlichem Traffic haerten

1. `POST /api/leads` gegen Spam und Abuse absichern.
2. Oeffentliche Formulare und Auth-nahe Endpunkte um Rate-Limit-/Abuse-Schutz ergaenzen.
3. Lokalen und privaten Dokumenten-Storage als bewusst vorlaeufig markieren und eine sichere Zielarchitektur definieren.

### 3. Monitoring und Betriebswahrheit bereinigen

1. `GET /api/health` fail-safe und wirklich minimal machen.
2. `GOOGLE_MAPS_API_KEY` aus Monitoring-/Health-Logik entfernen oder auf die tatsaechlich dokumentierten Key-Namen abbilden.
3. Monitoring nicht als "fertig" verkaufen, solange Queue-, Export-, Webhook- und E-Mail-Betrieb noch offen dokumentiert sind.

### 4. Kernprozess vor Modulausbau

Die naechste Prioritaet nach den Sicherheits-/Launch-Blockern ist nicht weiteres Feature-Wachstum, sondern die bezahlte Kernkette:

`Auftrag -> Zahlung -> Admin-Freigabe -> Ausfuehrung -> Bericht/Rechnung`

Alles, was diese Kette nicht direkter, sicherer oder glaubwuerdiger macht, steht danach.

### 5. Bewusst nach hinten schieben

Als Version-2-/spaetere Ausbaugebiete behandeln:

- CRM-Feinschliff
- Analytics-Ausbau
- Supply-Chain-/Multi-Lager-Vertiefung
- Karten-/Routing-/Heatmap-Feintuning
- Live-Tracking fuer Kunden
- Auszahlungen und tiefere Finanz-Integrationen

## Was ist sofort blockierend?

- kundenaufrufbare Mock-Zahlungskomplettierung
- oeffentliche revisionsrelevante PDFs unter `public/generated/*`
- freier Proof-Pfad ueber `url` oder rohe `imageDataUrl`

## Was ist Beta-tauglich, aber nicht launch-tauglich?

- lokale/mock-basierte Zahlungsablaeufe
- lokaler Dokumenten- und Artefakt-Storage
- manuelle Admin-/Lager-/Dispatch-/Tour-Freigaben
- Monitoring als Basis ohne vollstaendige Produktionshaertung
- fehlender sichtbarer Abuse-Schutz bei oeffentlichen Formularen

## Was ist eher Scope-/Narrativproblem als Akutrisiko?

- fehlendes Subscription-/SaaS-Modell
- zu breite Modulkommunikation nach aussen
- Version-2-Module, die bereits angelegt sind, aber nicht zur Launch-Haertung gehoeren

## Verifikation

Dieser Abgleich wurde auf Basis des aktuellen Repo-Stands, bestehender Projektdokumente und der verifizierten Checks erstellt:

- `npm run lint`
- `npm run build`

Die Checks bestaetigen den technischen Grundzustand des Repos, ersetzen aber keine Produktionsfreigabe fuer Payments, Dokumentenintegritaet, Abuse-Schutz oder rechtliche Themen.
