# FLYERO Technical Due Diligence und Sicherheits-Audit

Stand: 12.07.2026

Pruefobjekt: `C:\Users\Administrator\ecc`

Branch: `main`

Pruef-Commit: `3874c6def95b903d22ad4e948f1c07076efe6b47`

## 1. Auftrag und Pruefmethode

Dieser Bericht bewertet den aktuellen FLYERO-Stand als SaaS-, Betriebs- und spaeteres Due-Diligence-Objekt. Er ersetzt keine externe Penetrationspruefung, Rechtsberatung, Datenschutz-Folgenabschaetzung oder steuerliche Freigabe.

Die Bewertung basiert auf dem aktuellen Repository, dem Prisma-Schema, den API- und Service-Dateien, den Migrationen, den vorhandenen Smoke-Tests, den Deployment-Dateien und einer Erreichbarkeitspruefung von `https://flyero.org`.

Prioritaeten:

- `P0`: akute Sicherheits-, Datenverlust- oder Revenue-Gefahr; vor weiterem offenem Betrieb beheben
- `P1`: sehr wichtig; vor ersten zahlenden Kunden verbindlich schliessen
- `P2`: vor Skalierung oder groesserer Teamnutzung schliessen
- `P3`: professionelle Verbesserung
- `P4`: optionaler oder spaeterer Ausbau

Status:

- `vorhanden`: im aktuellen Code nachweisbar umgesetzt
- `teilweise`: brauchbare Basis, aber fuer das Zielbild nicht ausreichend
- `fehlt`: keine belastbare Umsetzung im aktuellen Repo nachweisbar

## 2. Executive Summary

FLYERO ist kein einfacher Landingpage-MVP mehr. Das Repository enthaelt einen breiten Next.js-Monolithen mit 76 Prisma-Modellen, 62 Enums, 187 API-Routen, 90 Seiten, 38 Migrationen und 52 Smoke-Testdateien. Auftrag, Checkout, Rechnung, Lager, Dispatch, Tour, externe GPS-Nachweise, Reports, CRM, Monitoring, E-Mail-Queue und mehrere Rollen sind fachlich abgebildet.

Der aktuelle Stand ist dennoch noch kein vollstaendig belastbares Multi-Tenant-SaaS und nicht ISO-27001- oder SOC-2-ready. Eine erste Mandantengrundlage ist jetzt vorhanden: `Tenant`, `TenantMembership` sowie verpflichtende `tenantId`-Felder auf den kundenbezogenen Kernmodellen. Kundenregistrierung, Lead-Konvertierung, Seed-Daten und zentrale Customer-APIs erzeugen bzw. pruefen aktive Kundenmandanten. Support-/Lager-Mitgliedschaften und sensible Dokument-/Reportpfade werden jetzt tenantbezogen geprüft; globale Adminpfade, Mitarbeiterverwaltung und die vollständige Policy-Migration bleiben offen.

Die groessten aktuellen Risiken sind:

1. `P0` Produktionsdaten und Uploads liegen operativ weiterhin ohne nachgewiesenen automatischen Offsite-Backup- und Restore-Nachweis.
2. `P0` Die Plattform ist noch nicht vollstaendig mandantenfaehig: Kunden-Kernkette, internes Tenant-Backfill und zentrale Membership-Policy sind gescoped; historische Admin-Pfade, Storage-Partitionierung und vollständige Ressourcenscopes fehlen noch.
3. `P1` Uploads haben jetzt einen ClamAV-Adapter, Quarantaene-Status und fail-closed Freigabepfad; produktive Scanner-/S3-Konfiguration, Altbestandsmigration und Restore-Nachweis fehlen.
4. `P1` Stripe-Reconciliation und ein serverseitiger Dispute-Prozess sind im Repo vorhanden; signierte Staging-Abnahmetests, Scheduler-/Live-Betriebsnachweise und operative Dispute-Verantwortung fehlen.
5. `P1` Externes Monitoring, Alarmierung, zentrale Request-Korrelation und Uptime-/Backup-Ueberwachung fehlen weiterhin.
6. `P1` AuditLogs haben jetzt Kontextfelder und eine optionale Tenant-ID, aber noch keine vollstaendige Anbindung aller kritischen Aktionen und kein extern manipulationsgeschuetztes Archiv.
7. `P1` MFA, Passwort-Historie und kompromittierte-Passwort-Pruefung fehlen trotz vorhandenem Passwort-Reset-Basispaket.

Positiv ist: Stripe-Webhook-Signaturen und Event-Idempotenz sind vorhanden, Mock-Zahlungen sind in Produktion standardmaessig deaktiviert, generierte PDFs werden inzwischen unter privatem Storage abgelegt, Kunden-Downloads sind rollen- und eigentumsgeprueft, externe GPS-Berichte koennen ohne erfundene Coverage veroeffentlicht werden, und die Domain ist per HTTPS erreichbar.

## 3. Repository- und Architektur-Analyse

### Aktueller Aufbau

| Bereich | Ist-Stand | Bewertung |
| --- | --- | --- |
| Framework | Next.js 16.2.9, React 19.2.4, TypeScript | vorhanden |
| Datenbank | PostgreSQL 16, Prisma 7.8.0 | vorhanden |
| Auth | Eigene JWT-Cookie-Session mit `jose`, Passwort-Hashing mit bcrypt | teilweise |
| Validierung | Zod in zentralen Validatoren und Services | vorhanden |
| Payments | Stripe Checkout, Webhook, Refunds, Payment-Historie | teilweise |
| Storage | Lokaler privater Dateispeicher und Docker-Volumes | teilweise |
| Reporting | Report-Snapshots, Freigabe, private Downloads, externe GPS-Belege | teilweise |
| Deployment | Docker Compose, Caddy, HTTPS, Postgres | vorhanden fuer Einzelserver-MVP |
| Tests | 52 Node-Smoke-Skripte, einschliesslich Auth-, Storage-, Permission-, Tenant- und Report-Smokes | teilweise |
| CI/CD | GitHub Actions fuer Prisma, Lint, Build, Security und kritische PostgreSQL-Smokes | vorhanden im Repo; Branch-Schutz/Staging extern offen |

### Architekturstaerken

- Fachlogik liegt haeufig in `src/lib/*` und nicht nur in UI-Komponenten.
- API-Routen verwenden ueberwiegend zentrale Auth- und Fehlerhelfer.
- Prisma-Migrationen sind versioniert; aktuell liegen 32 Migrationsverzeichnisse vor.
- Zahlungs-, Report-, Dokument- und Statushistorien sind als eigene Modelle vorhanden.
- Geschuetzte Kunden-Downloads pruefen Rolle, Eigentum und Freigabestatus serverseitig.

### Architekturrisiken

| ID | Befund | Prioritaet | Nachweis / Auswirkung |
| --- | --- | --- | --- |
| ARC-01 | Breiter modularer Monolith ohne explizite Modulgrenzen | P2 | 180 API-Routen und viele Services teilen eine Prisma-Instanz und gemeinsame Modelle. Aenderungen haben grossen Blast Radius. |
| ARC-02 | Server Components greifen teilweise direkt auf Prisma zu | P2 | UI, Datenzugriff und Autorisierung sind nicht durchgaengig ueber Services/Repositories getrennt. |
| ARC-03 | `globals.css` enthaelt weiterhin grosse Portal-/Order-Bloecke | P3 | `src/app/styles/portal.css` und `order.css` dokumentieren selbst, dass Styles spaeter verschoben werden. |
| ARC-04 | Keine explizite Background-Job-Infrastruktur | P2 | Notification-Queue wird ueber API/Admin-Prozess verarbeitet; kein externer Worker oder Scheduler ist deployt. |
| ARC-05 | Keine stabile API-Versionierung oder OpenAPI-Spezifikation | P2 | Spaetere Partner-/App-Integrationen koennen Vertragsaenderungen schwer kontrollieren. |

## 4. Datenbankanalyse

### Vorhanden

- 76 Modelle und 62 Enums bilden Order, Payment, Invoice, Warehouse, Dispatch, Tour, GPS, Report, Dokumente, CRM, Notifications, Monitoring, Audit und Tenant-Grundlagen ab.
- Fremdschluessel, Indizes, eindeutige Constraints und Zeitstempel sind an vielen Kernmodellen vorhanden.
- Stripe-Event-IDs sind eindeutig, Reportnummern und Verifikationscodes sind eindeutig.
- Migrationen sind versioniert und werden im Deployment mit `prisma migrate deploy` angewendet.

### Kritische Luecken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| DB-01 | Tenant-Grundmodell, internes Tenant-Backfill und zentrale Membership-Policy sind vorhanden; historische Adminpfade, globale Plattform-Admintrennung und vollständige Ressourcenscopes bleiben offen | P0 | Tenant-Filter auf alle internen Listen/Details ausweiten, Plattform-/Unternehmensrollen trennen und A/B-IDOR-Matrix vervollständigen. |
| DB-02 | Viele fachliche Snapshots und Metadaten liegen als freies `Json` vor | P2 | JSON nur fuer unveraenderliche Snapshots behalten; haeufig abgefragte oder sicherheitsrelevante Felder typisieren. |
| DB-03 | Soft Delete und Loesch-/Sperrkonzept sind nicht einheitlich | P2 | Datenklassen definieren und pro Modell `deletedAt`, Archivierung oder harte Loeschung verbindlich festlegen. |
| DB-04 | Retention-Dry-Run und Bereinigung fuer Tokens/Sessions/Buckets vorhanden; fachliche Fristen fuer GPS, Fotos und Reports noch offen | P1 | Datenklassen, Fristen und Legal-Hold-Ausnahmen fachlich freigeben und danach in automatisierte Jobs ueberfuehren. |
| DB-05 | Datenbankzugriff erfolgt mit einer allgemeinen App-Verbindung | P2 | Least-Privilege-DB-Rolle, getrennte Migrationsrolle und optional Read-only-Rolle definieren. |

## 5. Authentifizierungsanalyse

### Vorhanden

- Passwort-Hashes mit bcrypt und Cost 12.
- HTTP-only Cookie, `SameSite=Lax`, in Produktion `Secure`.
- JWT-Signatur mit mindestens 32 Zeichen langem `AUTH_SECRET`.
- E-Mail-Verifizierung mit zufaelligem Token und gehashtem Tokenwert.
- Offene Redirects werden durch relative `next`-Pfade begrenzt.
- Deaktivierte oder gebannte Nutzer koennen sich nicht neu einloggen.

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| AUTH-01 | DB-autorisierte `AuthSession` ist vorhanden; JWT bleibt Identitaetstraeger und Device-/MFA-Funktionen fehlen | P2 | Einzelne Geraete, MFA und Session-Rotation als kontrollierten Workflow ergaenzen. |
| AUTH-02 | Eigene aktive Sitzungen koennen angezeigt und alle anderen Sitzungen zentral widerrufen werden; einzelnes Device-Revoke fehlt | P2 | Einzelnen Geraetewiderruf, automatische Session-Bereinigung und erweiterte Sicherheits-UX ergaenzen. |
| AUTH-03 | DB-Rate-Limit fuer Login/Register/Verifizierung ist vorhanden; CAPTCHA/WAF und Monitoring fehlen | P1 | CAPTCHA/WAF fuer oeffentliche Angriffsflächen sowie Alarmierung und Retention ergaenzen. |
| AUTH-04 | Keine MFA-Unterstuetzung | P2 | TOTP/WebAuthn fuer Admin, Support, Buchhaltung und spaetere Enterprise-Kunden vorbereiten. |
| AUTH-05 | Passwort-Reset war im urspruenglichen Stand nicht vorhanden | P1 erledigt als Basispaket | Einmal-Token, 30-Minuten-Ablauf, DB-Rate-Limit, Session-Revoke, generische Antwort, E-Mail und AuditLog umgesetzt; MFA, Passwort-Historie und kompromittierte-Passwort-Pruefung bleiben offen. |
| AUTH-06 | Origin-Pruefung ist fuer mutierende JSON-/Formular-Requests zentral vorhanden; bodylose Mutationen und externe Rohbody-Webhooks folgen eigenen Schutzpfaden | P2 | Origin-/CSRF-Abdeckung der verbleibenden bodylosen Cookie-Mutationen und externe Integrationsvertraege separat verifizieren. |

## 6. Mandantentrennungsanalyse

Status: `Kunden-Kernphase umgesetzt`, `interne/Enterprise-Mandantenphase offen`.

Es gibt jetzt `Tenant` und `TenantMembership`. Kundenregistrierung und Lead-Konvertierung erzeugen einen aktiven Kundenmandanten mit einer aktiven Owner-Mitgliedschaft. `Order`, `Report`, `Payment`, `Refund`, `Invoice`, `Document` und `PrintOrder` tragen eine verpflichtende Tenant-ID; zentrale Customer-Listen, Detail- und Downloadpfade pruefen den Tenant serverseitig. Ein negativer Smoke-Test prueft getrennte Kundenmandanten und konsistente Kernverknuepfungen.

Konsequenzen:

- Ein Unternehmen kann noch nicht sauber mehrere Mitarbeiter mit unterschiedlichen Rechten verwalten.
- Globale Unique-Constraints koennen spaeter mandantenspezifische Anforderungen blockieren.
- Jede einzelne Query muss weiterhin individuell korrekt auf User/Customer gescoped werden.
- Admin ist plattformweit und nicht zwischen Plattform-, Unternehmens- und Supportrechten getrennt.
- Dateien und Storage-Keys enthalten noch keine explizite Mandantenpartition.

Empfohlene Zielstruktur vor weiteren Enterprise-Funktionen:

- `Tenant` und `TenantMembership` sind als Kernstruktur vorhanden.
- zentrale Permission-Codes statt nur grober Rollen
- `tenantId` auf den kundenbezogenen Kernmodellen ist vorhanden; interne Modelle muessen noch bewertet und migriert werden.
- zusammengesetzte Unique-Constraints mit `tenantId`
- Policy-Helper, der Tenant und Permission aus DB-Mitgliedschaft ermittelt
- negative Mandantentrennungstests fuer jede kritische Ressource

## 7. Rollen- und Rechteanalyse

### Vorhanden

- Rollen: Admin, Customer, Distributor, Warehouse Staff und Support/Dispatcher.
- Middleware/Proxy schuetzt Portal-Praefixe.
- API-Routen nutzen vielfach `requireRole()`.
- Kunden-Report- und Dokumentdownloads pruefen zusaetzlich Eigentum und Freigabestatus.

### Luecken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| RBAC-01 | Zentrale Permission-Matrix und aktive Tenant-Membership-Prüfung sind für sensible Pfade vorhanden; vollständige CRUD-/Tenant-Abdeckung fehlt | P1 | Alle internen APIs auf Permission- und Tenant-Policy migrieren. |
| RBAC-02 | Admin und Support/Dispatcher teilen viele Hochrisiko-Aktionen | P1 | Payment-Refund, Report-Publish, Nutzerverwaltung und Exporte getrennt berechtigen. |
| RBAC-03 | Kein Plattform-Superadmin vs. Unternehmensadmin | P1 | Im Zuge der Tenant-Architektur Rollenebenen trennen. |
| RBAC-04 | JWT trägt die Identität; `requirePermission()` liest zusätzlich die aktuelle DB-Membership, einige `requireRole()`-Pfade sind noch nicht migriert | P1 | Verbleibende interne APIs auf DB-authorisierte Permission-/Tenant-Prüfung umstellen. |
| RBAC-05 | Keine maschinenlesbare Berechtigungsmatrix | P2 | Rollen-/Permission-Matrix dokumentieren und als automatisierte Contract-Tests abbilden. |

## 8. Sicherheitsanalyse

### Positiv

- Prisma reduziert klassische SQL-Injection-Risiken.
- Zod-Validierung ist breit vorhanden.
- Caddy setzt `X-Content-Type-Options`, `X-Frame-Options` und `Referrer-Policy`.
- Stripe-Webhook-Signatur wird serverseitig geprueft.
- Kundendokumente und Berichte werden nicht ueber frei erratbare Public-URLs ausgeliefert.
- `npm audit --omit=dev` meldet keine hohen oder kritischen Advisories.

### Befunde

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| SEC-01 | DB-gestuetzter Auth- und Public-Abuse-Basisschutz fuer Login, Lead, Report-Verifikation und Maps ist vorhanden; externe Alarmierung fehlt | P1 | CAPTCHA/WAF, IP-Reputation und Alarmierung fuer Schwellenwerte ergaenzen. |
| SEC-02 | Persistente Public-Rate-Limits decken Lead, Report-Verifikation und die authentifizierten Google-Maps-Proxies ab; ein zentraler verteilter Edge-Limiter fehlt | P2 | Weitere sensible Endpunkte und den vorgeschalteten Edge-Limiter anbinden. |
| SEC-03 | Security-Header sind im Caddy-/Next-Pfad vorhanden; CSP muss gegen alle produktiven Drittanbieterpfade weiter verifiziert werden | P2 | Staging-CSP-Report-Only und anschliessende harte Abnahme etablieren. |
| SEC-04 | Magic-Byte-/Strukturpruefung, Quarantaene und Scanstatus sind vorhanden; produktiver ClamAV-Betrieb bleibt Deploymentnachweis | P1 | `FILE_SCAN_MODE=required` mit ClamAV betreiben und Scanalarme nachweisen. |
| SEC-05 | `svg`, Office-, ZIP- und Adobe-Dateien sind erlaubt | P1 | Aktive Inhalte nie inline ausliefern; Scan- und Download-Policy je Dateiklasse definieren. |
| SEC-06 | Fuenf moderate Dependency-Advisories | P2 | Prisma/Next-Updates kontrolliert testen; kein blindes `npm audit fix --force`. |
| SEC-07 | CodeQL und Dependabot sind im Repository vorhanden; GitHub-Branch-Schutz und Secret-Scanning-Einstellungen sind extern zu aktivieren | P1 | Repository-Regeln, Pflichtchecks und Secret-Scanning verbindlich aktivieren. |
| SEC-08 | Keine externe Penetrationspruefung | P1 vor Launch | Scope und Abnahme fuer Auth, Upload, Payments, IDOR und Adminpfade beauftragen. |

## 9. Datenschutzanalyse

Betroffene personenbezogene Daten umfassen Kontaktdaten, Rechnungsadressen, Verteilerprofile, GPS-Punkte, Foto-Metadaten, Supportkommunikation, IP-/User-Agent-Daten soweit spaeter erfasst sowie Zahlungsreferenzen.

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| DSGVO-01 | Technischer Retention-Dry-Run fuer Tokens/Sessions/Buckets vorhanden; sensible Nachweisdaten bleiben bis zur fachlichen Fristfreigabe erhalten | P1 | GPS-/Foto-/Dokumentenfristen, Legal Hold und Loeschpfade fachlich freigeben. |
| DSGVO-02 | Kein Self-Service fuer Auskunft, Export, Berichtigung und Loeschanfrage | P2 | Betroffenenrechte als kontrollierten Workflow implementieren. |
| DSGVO-03 | GPS-/Foto-Einwilligung und Rechtsgrundlage nicht im Produkt erzwungen | P1 | Einwilligungs-/Informationsprozess, Zweckbindung und Aufbewahrung mit Rechtsberatung definieren. |
| DSGVO-04 | Lokaler Storage ohne dokumentierte Verschluesselung auf Dateiebene | P1 | Verschluesselung at rest, Schluesselmanagement und Backup-Verschluesselung nachweisen. |
| DSGVO-05 | Keine AVV-/Subprocessor-Matrix im Repo | P2 | Hetzner, Resend/SMTP, Stripe, Google Maps und spaetere Anbieter dokumentieren. |
| DSGVO-06 | AuditLog-Datenmodell ist fuer Nachweis und Datenminimierung zugleich unvollstaendig | P1 | Pflichtfelder, Maskierung, Retention und Zugriffsrechte definieren. |

## 10. Stripe- und Zahlungsanalyse

### Vorhanden

- Checkout Session wird serverseitig erzeugt und einer eigenen Payment-Zeile zugeordnet.
- Betrag stammt aus der internen Order-/Pricing-Logik.
- Webhook-Signatur wird geprueft.
- `PaymentEvent.stripeEventId` ist eindeutig; verarbeitete Events werden als Duplikat erkannt.
- Payment-Statushistorie und Refund-Flow sind vorhanden.
- Mock-Zahlungen sind in Produktion ohne `ENABLE_MOCK_PAYMENTS=true` deaktiviert.
- Die neue Preisstaffel wird marginal berechnet; der Mindestauftrag liegt bei 599 EUR netto.

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| PAY-01 | Kein nachgewiesener Live-Mode-Abnahmetest mit echten Stripe-Testevents | P1 | Signierte Webhooks, Retry, Out-of-order Events, Abbruch und Refund in Staging testen. |
| PAY-02 | Read-only Stripe-Reconciliation mit persistierten Runs und Issues ist vorhanden; Scheduler-/Live-Stripe-Nachweis bleibt operativ offen | P1 | Job serverseitig regelmaessig ausfuehren, Fehler alarmieren und signierte Staging-/Live-Testevents nachweisen. |
| PAY-03 | Mock-Mechanismus bleibt im produktiven Code | P2 | Explizite Build-/Runtime-Grenze und Deployment-Check fuer `ENABLE_MOCK_PAYMENTS=false`. |
| PAY-04 | Stripe-Dispute-Akte, signierte Eventverarbeitung, Audit und Refund-Sperre sind vorhanden; Antwortprozess und externe Fristalarme fehlen | P1 | `PAYMENT_DISPUTES.md` als Betriebsprozess verwenden, Verantwortlichkeit festlegen und `dueBy` extern alarmieren. |
| PAY-05 | Kein getrenntes Staging-/Live-Secrets-Konzept im Repo dokumentiert | P1 | Environments, Key-Rotation und Secret-Verantwortung dokumentieren. |

## 11. GPS-, Foto-, Upload- und Speicheranalyse

### Aktueller MVP-Weg

Der primaere MVP-Nachweisweg ist ein externer GPS-Anbieter. Admins laden PDF und optional GPX/KML/KMZ sowie Fotos hoch. Ein Report kann ohne interne GPS-Punkte veroeffentlicht werden; Coverage-Werte bleiben dann `null`. Das ist fachlich ehrlicher als eine erfundene Abdeckung.

### Vorhanden

- Erlaubte Dateiendungen und maximale Groesse von standardmaessig 25 MB.
- SHA-256-Checksumme und zufaellige Storage-Keys.
- Externe Nachweise starten nicht kundensichtbar und muessen freigegeben werden.
- Kunden sehen nur eigene, veroeffentlichte Reports und freigegebene Dokumente.
- Report-Snapshot enthaelt Nachweis-IDs und verhindert automatische Coverage-Behauptungen ohne Rohdaten.
- Eigene GPS-Punkt-, Qualitaets- und Tourmodelle bleiben fuer spaeteren Ausbau vorhanden.

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| FILE-01 | Privater lokaler Storage ist Standard; S3-kompatibler Adapter und Backup-Scheduler sind vorhanden, produktive externe Konfiguration und Restore-Nachweis fehlen | P0 | Hetzner-S3/Storage-Box mit Versionierung, Verschluesselung, Lifecycle und Restore-Test aktiv betreiben. |
| FILE-02 | Dokument- und Foto-Uploads werden signaturgeprueft, bei fehlendem optionalem Scanner quarantainiert und vor erforderlicher Freigabe blockiert | P1 | ClamAV im Produktionscontainer/Host aktivieren, Quarantaene-Rescans betreiben und Altbestand bewerten. |
| FILE-03 | Keine ablaufenden Download-Tokens | P2 | Autorisierte Proxy-Downloads beibehalten oder kurzlebige signierte URLs verwenden. |
| FILE-04 | Neue `DocumentVersion`-Eintraege speichern unveraenderliche Storage-Keys; Altbestand ohne Key bleibt nicht abrufbar | P2 | Altbestand kontrolliert migrieren oder archivieren und Nachweis dafuer fuehren. |
| FILE-05 | Generierte Reports/Rechnungen liegen privat, aber Legacy-Read fuer `public/generated` bleibt | P2 | Legacy-Artefakte migrieren und Legacy-Pfad nach erfolgreicher Migration entfernen. |
| FILE-06 | Eigene Browser-GPS-Funktion existiert weiter, garantiert aber kein Background-Tracking | P2 | Produktcopy und Betrieb strikt beim externen GPS-MVP halten; Eigen-Tracking nur als nicht garantiertes Zusatzsystem. |
| FILE-07 | Keine dokumentierte GPS-/Foto-Loeschfrist | P1 | Zweckgebundene Retention und automatische Loeschung definieren. |
| FILE-08 | Synthetische Placeholder-Uploads sind entfernt; leere Uploads werden abgelehnt | erledigt | Regression durch Upload-Smoke und Dokumentservice beibehalten. |

## 12. Report- und PDF-Analyse

### Vorhanden

- Reportstatus, interne Review-Stati, Version und Snapshot sind vorhanden.
- Verteilung zwischen internem Tracking, externem GPS-Bericht und manueller Evidenz ist modelliert.
- Freigabe und Veroeffentlichung erzeugen AuditLogs und Kundenbenachrichtigungen.
- PDF-Downloads sind fuer Kunden auf eigene veroeffentlichte Reports begrenzt.
- Externe Reports erzeugen keine automatische Coverage ohne interne GPS-Rohdaten.

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| REP-01 | PDF-Generator ist ein einfacher Eigenbau und kein vollstaendiger Premium-/Rechtsreport | P1 | Reproduzierbaren Renderer mit Layouttests, Seitenumbruechen, eingebetteten Karten/Fotos und Versionierung einfuehren. |
| REP-02 | Report-Erzeugung informiert vor der Veroeffentlichung nur intern; die Kundenbenachrichtigung ist an `PUBLISHED` gekoppelt | erledigt | Regression ueber Report-Smoke und Statusworkflow beibehalten. |
| REP-03 | Snapshot-Versionierung ist vorhanden, aber Korrektur-/Altversionsansicht nicht vollstaendig operationalisiert | P2 | Unveraenderliche Versionen, aktuelle Version und interne Historie getrennt ausliefern. |
| REP-04 | Oeffentlicher Verify-Endpunkt gibt nach erfolgreichem Code weiterhin minimale Reportmetadaten aus; Rate-Limit und Audit-Minimierung sind vorhanden | P2 | Antwortfelder, Code-Entropie und Missbrauchsmonitoring vor Launch fachlich abnehmen. |

## 13. Testanalyse

### Ist-Stand

- 49 `.mjs`-Testdateien.
- Rund 842 Assert-Aufrufe in den vorhandenen Tests.
- Modulspezifische Smoke-Tests fuer Auth, Orders, Payments, Reports, Lager, Maps und UI-Quelltextregeln.
- Build und Lint sind als lokale Gates vorhanden.

### Bewertung

Die Testlandschaft ist fuer eine kontrollierte Beta wertvoll, ist aber kein vollstaendiges Unit-/Integration-/E2E-System. Viele Tests pruefen Quelltextmuster oder einen gemeinsam gestarteten Dev-Server. Es fehlen nachweisbare Coverage-Metriken, isolierte Unit-Tests, echte Browser-E2E-Flows in CI, Lasttests und systematische Security-Negativtests.

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| TEST-01 | CI-Ausfuehrung ist im Repository vorhanden; externe Pflichtstatus und Branch-Schutz sind noch nicht nachgewiesen | P1 | GitHub-Branch-Schutz und Pflichtchecks aktivieren und dokumentieren. |
| TEST-02 | Keine Coverage-Messung | P2 | Unit-/Integrationstest-Runner und Coverage-Grenzen fuer kritische Services einfuehren. |
| TEST-03 | Tenant-Smoke prueft Kunden, Kernobjekte und kundenbezogene Nebenressourcen; vollstaendige A/B-IDOR-Matrix fuer alle Ressourcen fehlt | P1 | Jede kritische Customer-Ressource mit Tenant-A/B-Negativtests erweitern. |
| TEST-04 | Kein echter Stripe-Staging-E2E | P1 | Stripe CLI/Testevents und Webhook-Retry in isolierter Umgebung pruefen. |
| TEST-05 | Keine Upload-Sicherheitsfixtures | P1 | Polyglot-, falsche MIME-, Oversize-, ZIP- und SVG-Testfaelle ergaenzen. |
| TEST-06 | Keine Last-/Performance-Baseline | P2 | API-, DB- und Upload-Baselines vor Skalierung festlegen. |

## 14. DevOps-, Monitoring- und Backup-Analyse

### Vorhanden

- Docker Compose mit Postgres 16, App und Caddy.
- Postgres ist nicht oeffentlich gemappt.
- Caddy terminiert TLS fuer `flyero.org` und `www.flyero.org`.
- App und Postgres besitzen Restart-Policy; Postgres hat einen Healthcheck.
- `https://flyero.org` antwortete bei der Pruefung mit HTTP 200; `/api/health` lieferte `{"status":"OK"}`.
- Interne ErrorLog-, SystemLog-, HealthCheck- und Queue-Modelle existieren.

### Health-Truthfulness-Haertung (13.07.2026)

- `GET /api/health` meldet ohne gespeicherten Check nicht mehr faelschlich `OK`, sondern konservativ `DEGRADED`.
- Der oeffentliche Health-Endpunkt setzt `Cache-Control: no-store`, damit ein alter Status nicht als aktueller Betriebsnachweis weitergereicht wird.
- `EMAIL_PROVIDER=mock` wird in Produktion nicht als echter Versand gewertet. SMTP und Resend werden nur bei den jeweils benoetigten Konfigurationswerten als `OK` bewertet.
- Der neue Contract-Smoke `npm run test:health-fail-safe` ist in CI eingebunden.
- Das ersetzt kein externes Uptime-/Error-Monitoring und keinen produktiven Alarmweg; OPS-05 und OPS-06 bleiben offen.

### Report-Nachweise-Tenant-Scope (13.07.2026)

- Der geschuetzte Admin-PDF-Download fuer Reports verlangt jetzt `REPORT_REVIEW` und prueft die Tenant-ID des Reports.
- Foto-Pruefung und Foto-Scan verlangen die passende Permission und pruefen den Tenant ueber den verknuepften Auftrag, bevor sie lesen oder mutieren.
- Externe GPS-/Foto-Nachweise und die Vorbereitung eines externen Reports verlangen jetzt `DOCUMENT_REVIEW` beziehungsweise `REPORT_REVIEW`; der Auftrag, die Tour und die manuelle Verteilerzuordnung werden im Service gegen den Tenant geprueft.
- Report-Neuerzeugung, Korrekturanforderung und Report-Erzeugung aus einer Tour verwenden ebenfalls `REPORT_REVIEW` und einen vorgelagerten Tenant-Existenzcheck.
- Report-Archivierung ist eine Admin-Publishing-Aktion und verlangt jetzt `REPORT_PUBLISH` statt einer reinen Rollenpruefung.
- `npm run test:report-evidence-tenant-scope` ist als CI-Contract eingebunden. Eine vollstaendige A/B-IDOR-Matrix aller internen Ressourcen bleibt weiterhin offen.

### Customer-Tenant-A/B-Matrix (13.07.2026)

- `tests/tenant-ab-idor-smoke.mjs` verwendet zwei echten, getrennten Tenants
  zugeordnete Demo-Kunden und authentifiziert sie mit getrennten Request-IPs.
- Die Customer-Listen fuer Auftraege, Reports, Rechnungen, Zahlungen und
  Dokumente werden fuer beide Konten geladen und auf fremde Datensaetze geprueft.
- Fremde Auftragsdetails, Auftragsdokumente, Rechnungsdetails/-downloads,
  Zahlungsdetails, Dokumentdetails/-downloads sowie veroeffentlichte
  Reportdetails/-downloads muessen `403` oder `404` liefern.
- Die Dokumentbibliothek prueft `orderId` jetzt vor jeder gefilterten Liste
  ueber `assertOrderAccess`; dadurch ist auch der Auftragsdokumentpfad gegen
  fremde Tenant-IDs geschlossen.
- `npm run test:tenant-ab-idor` laeuft lokal und ist im kritischen CI-Job gegen
  den isolierten PostgreSQL-Testserver eingebunden. Die vollstaendige A/B-Matrix
  fuer interne Support-, Lager-, Dispatch- und Admin-Ressourcen bleibt offen.

### Warehouse-Ressourcen-Scope (13.07.2026)

- Lagerpersonal benoetigt fuer sensible Warehouse-Mutationen weiterhin eine
  aktive interne Membership und darf nur das zugewiesene Lager bearbeiten.
- Check-in prueft den dem Auftrag zugewiesenen Lagerstandort und den Bestand
  erneut gegen `inventoryScopeForUser`, bevor Status, Mengen oder Lagerplatz
  mutiert werden.
- QR-Erzeugung, Lagerplatzzuweisung und Statusaenderung laden den Bestand jetzt
  mit derselben Lagergrenze; Inventurlisten filtern zusaetzlich ueber den
  zugeordneten Bestand und Support ueber den aktiven Tenant.
- Inventur-Erstellung akzeptiert nur das tatsaechliche Lager des Bestands und
  validiert diese Beziehung nochmals im Logistics-Service.
- `npm run test:warehouse-scope` prueft diese Grenzen mit einem echten
  Warehouse-Login und einem Bestand aus einem fremden Seed-Lager. Die A/B-
  Matrix fuer Support-, Dispatch- und sonstige interne Ressourcen bleibt offen.

### Support-Ticket-Permissions (13.07.2026)

- Admin-/Support-Ticketlisten und Details verlangen jetzt getrennt
  `SUPPORT_TICKET_VIEW`; Erstellen, Bearbeiten, Antworten und Schliessen
  verlangen `SUPPORT_TICKET_MANAGE`.
- `requirePermission()` prueft dabei die aktive Membership serverseitig.
  Die zentrale Support-Sicht bleibt als plattformweiter Betriebsprozess
  bestehen; Kunden- und Verteilerpfade bleiben weiterhin fachlich scoped.
- `npm run test:support-permission` ist in CI eingebunden. Eine vollständige
  Laufzeitmatrix für alle internen Support-/Dispatch-Ressourcen bleibt offen.

### Verteiler-Datensparsamkeit (13.07.2026)

- Die Verteiler-API und die servergerenderten Touransichten laden nicht mehr
  `customer: true`. Eine gemeinsame Privacy-Whitelist gibt nur operative
  Auftragsfelder wie Auftragsnummer, Gebiet, Ort und Flyerzahl frei.
- Auch Lagerdaten werden auf Abholort, Fach, Menge, QR-Code und Status
  begrenzt; interne Lagerkontakte und nicht benoetigte Reservierungsfelder
  werden nicht an Verteiler serialisiert.
- Der Zugriff auf Tourdetails bleibt an die eigene `distributorId` gebunden;
  eine fremde Tour-ID liefert `404`. Der neue
  `npm run test:distributor-privacy`-Smoke prueft Response-Daten und HTML
  gegen reale Seed-Touren.
- Damit ist der konkrete Kunden-Daten-Leak in den Verteiler-Hauptansichten
  geschlossen. Eine vollstaendige Laufzeitmatrix fuer alle internen
  Dispatch-, Support- und Admin-Responses bleibt als Audit-Risiko offen.

### Proof-Download-Freigabe (13.07.2026)

- Der Foto-Download fuer Kunden prueft neben dem eigenen Auftrag jetzt auch
  `customerVisible = true` und `reviewStatus = APPROVED`.
- Interne oder noch nicht gepruefte Fotos werden nicht ausgeliefert und
  antworten fuer den Kunden mit `404`, auch wenn eine Foto-ID bekannt ist.
- `npm run test:proof-download-privacy` deckt diesen Fall mit einem echten
  Seed-Foto ab. Admin-/Support- und eigener Verteilerzugriff bleiben separat
  rollenbasiert; die vollstaendige Matrix aller internen Proof-Responses
  bleibt offen.

### Maps-Abuse-Schutz (13.07.2026)

- Die authentifizierten Google-Maps-Proxy-Routen fuer Autocomplete, Geocoding
  und Order-Intelligence verwenden jetzt einen gemeinsamen persistenten
  PostgreSQL-IP-Bucket mit standardmaessig 60 Anfragen je 15 Minuten.
- Die Grenzwerte sind ueber `PUBLIC_MAPS_RATE_LIMIT_MAX` und
  `PUBLIC_MAPS_RATE_LIMIT_WINDOW_MS` konfigurierbar und werden nicht als
  Secret behandelt.
- `npm run test:maps-abuse` prueft alle drei Routen statisch und verifiziert
  den `429`-Schutz mit einer echten authentifizierten Anfragefolge, ohne
  einen externen Google-Aufruf auszufuehren.
- Der Schutz reduziert API-Kosten- und Abuse-Risiken, ersetzt aber keinen
  vorgeschalteten WAF-/Edge-Limiter oder externes Alarmierungsmonitoring.

### Route-Analyse-Scope (13.07.2026)

- `/api/tours/[id]/route-analysis` nutzt jetzt eine relationale Query-Grenze:
  Kunden erhalten nur eigene Touren, Verteiler nur eigene Touren und Admins
  behalten die Plattformsicht.
- Die Analyse laedt nur Tour-ID, Pausenwert, Zielgeometrie und GPS-Punkte;
  komplette Kunden- oder Verteilerprofile werden nicht mehr fuer eine
  nachgelagerte Autorisierungsentscheidung geladen.
- Fremde Tour-IDs liefern `404`; `npm run test:route-analysis-privacy` prueft
  den eigenen und den fremden Kunden-Tourpfad. Eine vollstaendige A/B-Matrix
  fuer alle weiteren internen Detailrouten bleibt offen.

### Rechnungs-PDF-Tenant-Scope (13.07.2026)

- Der interne Rechnungs-PDF-Download verlangt jetzt `INVOICE_VIEW`; Admin bleibt global, Support benoetigt eine aktive Unternehmensmitgliedschaft.
- Die Rechnung wird vor dem Lesen mit `tenantWhereForSession` geladen, statt nur ueber eine erratbare Rechnungs-ID gefunden zu werden.
- Die Permission ist in `PERMISSION_MATRIX.md` und `npm run test:permissions` verankert. Weitere Finanz- und Exportrouten bleiben separat zu pruefen.

### Produktions-Preflight (13.07.2026)

- `scripts/production-preflight.mjs` prueft vor einem Produktionsstart HTTPS-URLs, Auth- und Datenbankkonfiguration, Stripe-Webhooks, echte E-Mail-Provider, Google-Maps-Keys, privaten S3-Storage, erforderlichen Malware-Scan und externes Restic-Backup.
- Der Check akzeptiert keine Mock-Zahlungen oder `EMAIL_PROVIDER=mock` und gibt keine Secretwerte aus.
- Er ist als `ENV_FILE=.env.production npm run production:preflight` manuell vor dem Deployment auszufuehren; die laufende App wird bewusst nicht automatisch blockiert, damit lokale Beta- und Migrationsprozesse nicht unkontrolliert ausfallen.
- `npm run test:production-preflight` prueft eine gueltige Konfiguration sowie die Ablehnung des Mock-Mailproviders und ist in CI eingebunden.

### Request-ID-Korrelation (13.07.2026)

- Der Proxy erzeugt oder validiert eine begrenzte `x-request-id` fuer API- und geschuetzte Portal-Aufrufe, reicht sie an die Route weiter und gibt sie in der Response zurueck.
- `createAuditLog` liest den aktuellen Request-Kontext automatisch, wenn eine Route keinen expliziten Kontext uebergibt.
- System-, Error- und Background-Job-Logs uebernehmen die Request-ID zusaetzlich in ihren Metadaten; sensible Headerwerte werden weiterhin begrenzt.
- `RESOURCE_SCOPE_POLICY.md` dokumentiert jetzt explizit, warum CRM-Leads und Betriebslogs im MVP plattformweit bleiben und welche Ressourcen zwingend tenant-sensibel sind. Diese Dokumentation ersetzt keine spaetere A/B-IDOR-Testmatrix.
- Der Contract-Smoke `npm run test:request-id-propagation` ist in CI eingebunden. Das behebt die Repository-seitige Basiskorrelation, ersetzt aber kein externes Error-/Performance-Monitoring und keine vollständige Korrelation von bereits bestehenden historischen Logs.

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| OPS-01 | Backup-Units, Installer und Restic-Skript sind im Repository; produktive Offsite-Ausfuehrung und Alarmnachweis fehlen | P0 | Hetzner-Ziel aktivieren, ersten Snapshot pruefen und Fehleralarm nachweisen. |
| OPS-02 | Restore-Runbook und Restore-Skript sind vorhanden; ein echter isolierter Restore ist noch nicht nachgewiesen | P0 | Staging-Restore regelmaessig ausfuehren und Ergebnis versioniert dokumentieren. |
| OPS-03 | Single-Server-/Single-Postgres-Betrieb | P2 | Vor Skalierung Managed DB oder replizierte Zielarchitektur, Wartungsfenster und RTO/RPO definieren. |
| OPS-04 | GitHub Actions/CodeQL sind vorhanden; Staging-/Preview-Umgebung und externe Branch-Regeln fehlen | P1 | Getrennte Staging-Secrets und verpflichtende PR-Gates aktivieren. |
| OPS-05 | Kein externes Error-/Uptime-/Performance-Monitoring | P1 | Uptime-Check, Error Tracking, Metriken und Alarmwege einrichten. |
| OPS-06 | Request-ID-Basiskorrelation fuer neue API-/Portal-Requests ist vorhanden; historische Logs und externe Korrelation bleiben offen | P1 | Request-ID im externen Monitoring/Deployment nachweisen und bestehende Hintergrundprozesse sowie historische Daten migrieren, wo fachlich erforderlich. |
| OPS-07 | Caddy-Header unvollstaendig und `X-Powered-By` sichtbar | P2 | Header-Haertung und Next.js-Powered-By deaktivieren. |
| OPS-08 | Docker-Images sind nicht auf Digest gepinnt | P2 | Reproduzierbare Images und kontrollierte Update-Policy einfuehren. |
| OPS-09 | Kein Deploy-Rollback- oder Zero-Downtime-Verfahren | P2 | Release-Artefakte, Rollback und Migration-Kompatibilitaet dokumentieren. |

## 15. Dokumentationsanalyse

### Vorhanden

- Umfangreiches README.
- Deployment-Anleitung fuer Hetzner.
- Architekturentscheidungen, Beta-Checkliste, Known Issues, Datenqualitaets- und MVP-Nachweisdokumente.
- Demo-Benutzer und Modulbeschreibungen.

### Luecken und Drift

- `BETA_RELEASE_CHECKLIST.md` und `KNOWN_ISSUES.md` sollten nach jedem Sicherheits-/Betriebspaket gegen den aktuellen Stand gespiegelt werden; einzelne historische Aussagen koennen noch veraltet sein.
- Mehrere Dokumente und UI-Strings zeigen Encoding-Fehler wie `fÃ¼r` statt `fuer`/`für`.
- Systemarchitektur, Permission-Matrix und Backup-/Restore-Runbook sind vorhanden; API-Spezifikation, Incident-Response, Release-Prozess, Vendor-Matrix und Datenklassifikation fehlen weiterhin.
- Dokumentation nennt ISO 27001/SOC 2 als Ziel, aber es gibt noch kein Control-Mapping oder Evidenzregister.

Prioritaet: `P1` fuer Betriebs- und Sicherheitsrunbooks, `P2` fuer vollstaendige Due-Diligence-Dokumentation.

## 16. Exit-Readiness-Analyse

### Positiv

- Git-Historie, Migrationen und klare Repo-Struktur sind vorhanden.
- Abhaengigkeiten sind ueber Lockfile reproduzierbar.
- Architekturentscheidungen und Known Issues existieren bereits als Basis.
- Der Kernprozess ist fachlich im eigenen Code abgebildet und nicht vollstaendig an einen No-Code-Anbieter gebunden.

### Fehlende Verkaufs-/Due-Diligence-Unterlagen

| Artefakt | Status | Prioritaet |
| --- | --- | --- |
| Architektur- und Datenflussdiagramm | fehlt | P2 |
| Vollstaendige API-Dokumentation | fehlt | P2 |
| Rollen-/Permission-Matrix | fehlt | P1 |
| Infrastrukturinventar und Kosten | teilweise | P2 |
| Open-Source-Lizenzinventar | fehlt | P2 |
| Contributor-/IP-Abtretungsnachweise | ausserhalb Repo, nicht nachweisbar | P1 organisatorisch |
| Security- und Incident-Historie | fehlt | P2 |
| Backup- und Restore-Nachweise | fehlt | P0 |
| Penetrationstest-Bericht | fehlt | P1 vor Launch |
| AVV-/Subprocessor-Liste | fehlt | P1/P2 |
| SLA, RTO und RPO | fehlt | P2 |
| Technische-Schulden-Register | teilweise | P2 |
| Release-Historie und Freigaben | teilweise ueber Git | P2 |

## 17. Priorisierte Roadmap

### Sofort kritisch

1. Automatische verschluesselte Offsite-Backups fuer Postgres und beide Storage-Bereiche einrichten.
2. Restore-Runbook erstellen und einen echten Restore in isolierter Umgebung nachweisen.
3. Tenant-Zielarchitektur fuer interne Rollen und Enterprise-Mitgliedschaften vervollstaendigen, bevor weitere Unternehmensfunktionen entstehen.
4. Produktion pruefen: `ENABLE_MOCK_PAYMENTS=false`, echte E-Mail-/Stripe-Secrets getrennt, keine Demo-Seeds.

### Vor oeffentlichem Launch

1. DB-autorisierte Sessions mit sofortiger Sperr-/Rollenwirkung.
2. Zentraler Rate-Limiter fuer Login, Registrierung, Verifizierung, Leads und Verify-Endpunkte; weitere oeffentliche APIs danach ergaenzen.
3. Upload-Quarantaene, Magic-Byte-Pruefung und Malware-Scan.
4. GitHub-PR-Gates mit Lint, Build, Prisma Validate, Tests, Dependency- und Secret-Scans.
5. Externes Error-/Uptime-Monitoring und Alarmierung.
6. Stripe-Staging-E2E inklusive Webhook-Retry, Refund und Abbruch.
7. Security-Header, CSP und Request-ID-Haertung.
8. Datenschutz-, AGB-, Impressum- und Tracking-Freigabe durch Fachleute.

### Vor ersten zahlenden Kunden

1. E-Mail-Zustellung mit SPF, DKIM, DMARC und Bounce-/Complaint-Behandlung.
2. PDF-/Rechnungsinhalte fachlich und steuerlich abnehmen.
3. Externe GPS-/Foto-Aufbewahrung, Einwilligung und Kundenfreigabe verbindlich dokumentieren.
4. Support-, Incident-, Refund-, Chargeback- und Datenwiederherstellungsprozess ueben.
5. Dokumentversionen unveraenderlich speichern und exakt versioniert ausliefern.

### Vor Skalierung

1. Kunden-Tenant-Grundlage auf interne Rollen, Storage-Partitionierung und zentrale Policies erweitern.
2. Permission-basiertes RBAC statt grober Rollen.
3. Privaten Objekt-Storage und Managed/HA-Datenbank evaluieren.
4. Background-Worker und Scheduler von Webrequests trennen.
5. Performance-, Last- und Kapazitaetsbaselines definieren.
6. Observability mit Metriken, Traces und zentralen Logs ausbauen.

### Vor Enterprise-Kunden

1. MFA/WebAuthn, SSO-Vorbereitung und Session-/Geraeteverwaltung.
2. Tenant-Admins, SCIM-/Provisioning-Roadmap und granulare Permissions.
3. Audit-Export, Retention, Legal Hold und kundenspezifische Datenresidenz pruefen.
4. SLA, Statusseite, Support-Eskalation und dokumentierte RTO/RPO.
5. Externer Penetrationstest und Behebung aller hohen Befunde.

### Vor ISO 27001

1. ISMS-Scope, Asset-Register, Risiko-Register und Statement of Applicability.
2. Policies fuer Zugriff, Change, Incident, Backup, Lieferanten und sichere Entwicklung.
3. Control-Evidenz aus GitHub, Monitoring, Backups, Reviews und Schulungen sammeln.
4. Regelmaessige Access Reviews, Restore-Tests, Schwachstellenscans und Management Reviews.

### Vor SOC 2

1. Trust-Service-Kriterien auf technische und organisatorische Controls mappen.
2. Evidenzautomatisierung fuer Deployments, Zugriffe, Incidents, Backups und Monitoring.
3. Kontrollperiode mit stabilen Prozessen und lueckenloser Nachweisfuehrung.

### Vor Unternehmensverkauf

1. IP-Kette, Contributor-Vertraege und externe Entwicklungsleistungen belegen.
2. Lizenzinventar, Vendor-Vertraege, Datenexport- und Exit-Strategien vollstaendig halten.
3. Architektur, Betriebswissen und Runbooks so dokumentieren, dass kein kritischer Prozess nur beim Gruender liegt.
4. Technische Schulden, Sicherheitsvorfaelle, Verfuegbarkeit, Kosten und Risiken transparent historisieren.

## 18. Konkrete P0-/P1-Umsetzungsreihenfolge

Die Reihenfolge minimiert zuerst Datenverlust und unkontrollierten Zugriff, danach Revenue- und Betriebsrisiken:

1. Backup und Restore
2. Session-/Account-Sperrung und Auth-Rate-Limit
3. CI-/Security-Gates
4. Upload-Sicherheit und privater Objekt-Storage-Zielpfad
5. Stripe-Staging-/Reconciliation-Haertung
6. Externes Monitoring, Alarmierung und Request-IDs
7. AuditLog-v2 und Permission-Matrix
8. Tenant-Policies, interne Rollen und schrittweise Migration
9. Datenschutz-/Retention-Automation
10. PDF-/Dokumentversionierungs-Haertung

## 19. Aktuelle Betriebsfreigabe

| Nutzung | Einschaetzung |
| --- | --- |
| Lokale Entwicklung | geeignet |
| Interne Demo | geeignet |
| Kontrollierte Beta mit wenigen bekannten Nutzern | bedingt geeignet, Backups und Live-Secrets zwingend |
| Oeffentlicher Launch mit zahlenden Kunden | noch nicht freigegeben |
| Skalierter Multi-Tenant-Betrieb | nicht geeignet |
| Enterprise-/ISO-/SOC-2-Betrieb | nicht geeignet |

## 20. Verifikationsnachweise dieser Auditphase

- Git `main` war vor der Auditdokumentation sauber und synchron mit `origin/main` auf `f7d6c65`.
- `https://flyero.org` antwortete am 12.07.2026 mit HTTP 200 ueber Caddy/HTTPS.
- `https://flyero.org/api/health` antwortete mit `{"status":"OK"}`.
- `npm audit --omit=dev --audit-level=high` meldete fuenf moderate, aber keine hohen oder kritischen Advisories. Die vorgeschlagenen Force-Fixes waeren breaking und wurden nicht automatisch angewendet.
- In den Folgepaketen wurden produktive Code-, Schema- und Migrationsaenderungen umgesetzt; der PostgreSQL-Port blieb unveraendert auf `127.0.0.1:5432`.

## 21. Naechster Gate

Der naechste sinnvolle Umsetzungsschritt ist kein weiteres Fachmodul. Die Repository-Pakete fuer Backup/Restore, DB-autorisierte Sessions, Auth-Abuse-Schutz, Security-Header und die Kunden-Kern-Tenanttrennung sind umgesetzt. Als naechstes bleiben produktive Betriebsnachweise, externe Kontrollen und die vollstaendige A/B-IDOR-Matrix fuer alle Rollen und Nebenressourcen.

## 22. Umsetzungsfortschritt nach dem Audit

### Aktueller Abgleich nach den Folgepaketen

Der Auditbericht wurde nach dem ursprünglichen Prüflauf weitergeführt. Folgende Befunde sind inzwischen nachweisbar verändert:

- **DB-autorisierte Sessions: vorhanden.** `AuthSession` prüft Ablauf, Widerruf und den aktuellen Benutzerstatus sowie die aktuelle Rolle aus PostgreSQL.
- **Auth-Abuse-Schutz: vorhanden als DB-gestützter Basisschutz.** Login, Registrierung, Verifizierungs-Resend und E-Mail-Verifizierung verwenden gehashte IP-/Account-Buckets. Öffentliche Lead- und Report-Verifikation verwenden zusätzlich persistente Public-Rate-Limit-Buckets. CAPTCHA, WAF, IP-Reputation und alarmiertes Monitoring bleiben offen.
- **Security-Header: vorhanden.** Caddy setzt HSTS, CSP, Permissions-Policy, `nosniff`, `X-Frame-Options` und `Referrer-Policy`; Next.js deaktiviert `X-Powered-By`.
- **CI/Security-Gates: vorhanden im Repository, extern noch zu aktivieren.** GitHub Actions prüfen Prisma, Lint, Build, kritische Smokes, CodeQL und Dependabot. Branch-Schutz und verpflichtende Checks sind GitHub-Repository-Einstellungen und nicht allein aus dem Code ableitbar.
- **Upload-Prüfung: teilweise vorhanden.** Bekannte PDF-, Bild-, Archiv- und XML-Typen werden zusätzlich zur Endung über Signaturen bzw. XML-Anfang geprüft; JSON-Uploads benötigen echte Base64-Dateiinhalte; Tour-Fotos akzeptieren nur PNG/JPG/WEBP. Malware-Scan, Quarantäne und privater Objekt-Storage fehlen weiterhin.
- **Placeholder-Uploads: behoben.** Der Dokumentservice lehnt fehlende oder leere Inhalte ab und erzeugt keinen synthetischen Ersatzinhalt mehr.
- **Dokumentversionen: verbessert.** `DocumentVersion.storageKey` speichert für neu erzeugte Dateien den unveränderlichen privaten Storage-Key. Versionsdownloads lesen exakt diese Version; historische Versionen ohne nachweisbaren Key bleiben bewusst nicht abrufbar.
- **Premium-Preislogik: vorhanden.** Die marginale Staffel und der Mindestauftrag von 599 EUR netto sind als `premium-distribution-v4` versioniert und werden über Gebiet-/Checkout-Smokes mit Schwellenfallprüfungen verifiziert.
- **Zentrale Permission-Matrix: teilweise vorhanden.** `src/lib/permissions.ts` definiert die ersten maschinenlesbaren Berechtigungen. Finanz-, Preis-, Nutzer- und Veröffentlichungsaktionen sind serverseitig auf `ADMIN` begrenzt; operative Reportprüfung und Analytics-Lesen sind für Support/Disposition getrennt freigegeben. Analytics-, Support-KPI- und Dokument-KPI-Aggregationen erhalten jetzt den aktuellen Tenant-Scope; die vollständige Migration aller internen APIs und die A/B-IDOR-Matrix bleiben offen.
- **Ephemerer Retention-Prozess: als kontrollierter Dry-Run vorhanden.** `scripts/retention.mjs` berechnet und bereinigt nach ausdrücklicher Aktivierung abgelaufene Verifizierungstoken, alte Sessions sowie inaktive Auth- und Public-Rate-Limit-Buckets. GPS-, Foto-, Dokument-, Audit- und Rechnungsdaten werden bewusst nicht generisch gelöscht, solange Zweckbindung, gesetzliche Fristen und Legal Hold nicht fachlich freigegeben sind.
- **Privater Object-Storage-Pfad: technisch vorbereitet, operativ noch offen.** `src/lib/privateObjectStorage.ts` bündelt lokale und S3-kompatible private Ablage für Dokumente sowie generierte Dateien. Lokal bleibt der Entwicklungsfallback aktiv; Produktion muss Bucket, Verschlüsselung, Versionierung, Lifecycle, initiale Migration und Restore-Test noch nachweisen.

Damit sind die früheren Befunde `AUTH-01`, `AUTH-03`, `SEC-03`, `SEC-07` und `FILE-08` nicht mehr als unverändert fehlend zu bewerten. `SEC-04` und `FILE-04` sind teilweise beziehungsweise durch die Folgeänderung für neu erzeugte Versionen behoben; Quarantäne, Malware-Scan und Altbestandsmigration bleiben offen.

### Admin-Preis-Propagation und CSRF-Basisschutz

- Aktive `PricingRule`-Datensaetze sind die Quelle fuer Gebietsintelligenz,
  neue Kundenorders und offene Checkouts. Deaktivierte historische Regeln
  werden nicht mehr als aktuelle Settings angeboten; `pricing:sync-premium`
  synchronisiert die drei Produktionsstaffeln ohne Demo-Seed.
- `npm run test:pricing-admin-propagation` prueft Adminaenderung,
  Kundenpreview, Order-Snapshot und Checkout-Neuberechnung. Aenderungen
  werden zusaetzlich auf offene, unbezahlte Orders ohne manuellen Preis
  propagiert; bezahlte Orders und gestartete Checkouts bleiben unveraendert.
- Admin-Staffeln werden vor dem Speichern auf positive Mengen, Luecken,
  Ueberschneidungen und Preisabfaelle an Schwellen geprueft. Settings- und
  API-Speicherungen laufen atomar in einer Transaktion.
- `readBody()` validiert `Origin` gegen Request- und Site-Origin. Fremde
  Origins werden mit `403` abgewiesen. Stripe-Webhooks bleiben im
  signaturgeprueften Rohbody-Pfad.
- Bodylose Cookie-Mutationen und externe Integrationsvertraege benoetigen
  weiterhin eine separate CSRF-/Origin-Abnahme.

### Aktueller Upload-Scan-Stand

Dokument- und Tour-Foto-Uploads besitzen jetzt einen Scanstatus, werden bei fehlendem optionalem Scanner in einem privaten Quarantänepfad abgelegt und können über Admin-Rescans erneut geprüft werden. In Produktion muss `FILE_SCAN_MODE=required` mit ClamAV gesetzt sein; produktiver Scannerbetrieb, Altbestandsmigration und Restore-Nachweis bleiben offen.

### Tenant-Nebenressourcen

`DistributionArea`, `SupportTicket` und `OrderExperienceEvent` speichern bei Kundenbezug jetzt die Tenant-ID. Customer-Seiten, Kartenintelligenz, Support, gespeicherte Gebiete und UX-Ereignisse akzeptieren nur den eigenen Tenant oder explizit globale Plattformgebiete. Eine vollstaendige A/B-IDOR-Matrix fuer alle Ressourcen bleibt offen.

### Analytics-Tenant-Scope

Nicht-admin interne Sitzungen werden in den Analytics-/Exportpfaden jetzt bis in die
Aggregate durchgereicht. Orders, Zahlungen, Refunds, Kunden, Verteiler, Touren, Lager,
Reports, Support-KPIs und Dokument-KPIs werden mit der aktiven Tenant-ID abgefragt.
Plattform-Admins bleiben bewusst global. Unverknuepfte oeffentliche Leads werden fuer
tenant-scoped Support-Auswertungen nicht als fremde Daten sichtbar gemacht. Der neue
`tests/analytics-tenant-scope-smoke.mjs` prueft den Vertrag; ein vollstaendiger A/B-
Integrationstest fuer jede interne Ressource steht weiterhin aus.

### Dispatch-Tenant-Scope

Der Support-/Dispositionspfad validiert Auftragszugriffe jetzt gegen die aktive
Tenant-ID. Dispatch-Dashboard, Empfehlungen, Auto-Zuweisung, Zuweisung und das
Ignorieren von Empfehlungen reichen den Scope serverseitig bis in die Prisma-
Abfragen durch. Plattform-Admins bleiben global; fehlende Tenant-Zuordnung bei
Nicht-Admins fuehrt zu einem leeren, nicht zu einem globalen Scope. Die weitere
Migration von Logistik-, CRM-, Monitoring- und Nebenressourcen bleibt offen.

### Logistik-Tenant-Scope

Sendungen, Umlagerungen, Inventurdifferenzen und Logistik-KPIs werden fuer
Nicht-Admins jetzt ueber den verknuepften Auftrag tenantbezogen gelesen und
geschrieben. Erstellen, Statusaenderungen und Bestandszaehlungen validieren den
Tenant vor der Mutation. Lagerstammdaten bleiben gemeinsame Plattformressourcen;
die vollstaendige A/B-IDOR-Pruefung der restlichen internen Bereiche bleibt offen.

### P0 Backup-Scheduler

Der automatische Betriebsweg ist als Repository-Paket vorbereitet:

- `deploy/flyero-backup.service` laeuft als Benutzer `flyero`, nutzt eine private `/etc/flyero`-Konfiguration und verhindert parallele Laeufe mit `flock`.
- `deploy/flyero-backup.timer` plant taegliche Backups mit `Persistent=true` und einer Zufallsverzoegerung.
- Ein Failure-Service schreibt fehlgeschlagene Laeufe ins Systemjournal; ein externer Alarmkanal bleibt bewusst Betreiberaufgabe.
- `scripts/install-backup-systemd.sh` bricht ohne Restic, Docker, Konfiguration oder Passwortdatei ab und aktiviert den Timer erst nach den Checks.
- `tests/backup-scheduler-smoke.mjs` und der CI-Critical-Smoke pruefen Units, Installer und Konfigurationsvertrag.

Das ist noch kein produktiver Backupnachweis: Hetzner Storage Box/S3, Restic-Initialisierung und ein echter Staging-Restore muessen auf dem Server ausgefuehrt und dokumentiert werden.

### P1 AuditLog-v2

Der AuditLog-Kontext wurde als begrenzte, rueckwaertskompatible Erweiterung umgesetzt:

- `requestId`, `ipAddress`, `userAgent` und `result` sind nullable beziehungsweise mit `SUCCESS` vorbelegt, damit historische Eintraege migrierbar bleiben.
- `src/lib/auditRequestContext.ts` uebernimmt nur eine begrenzte Request-ID, den ersten Proxy-IP-Wert und maximal 512 Zeichen User-Agent. Passwoerter, Cookies, Tokens und Request-Bodies werden nicht gespeichert.
- Login und Logout schreiben den Request-Kontext mit. Bestehende Service-Aufrufe bleiben ohne kuenstliche Nachruestung kompatibel.
- `tests/audit-log-v2-smoke.mjs` und der CI-Critical-Smoke pruefen Schema, Migration, Sanitization und die beiden Auth-Routen.

Die AuditLog-Anbindung hat bereits eine optionale Tenant-ID. Offen bleiben die konsequente Kontextanreicherung aller kritischen Zahlungs-, Webhook-, Dokument- und Report-Aktionen sowie ein externes, manipulationsgeschuetztes Logziel mit verbindlicher Aufbewahrung.

### P1 CI- und Security-Gates

Nach der Bestandsaufnahme wurde das erste risikoarme P1-Paket umgesetzt:

- `.github/workflows/ci.yml` prueft Pull Requests und Pushes auf `main` mit Node.js 22.
- Der Quality-Job fuehrt Prisma-Validierung, Prisma-Generierung, Lint, Produktions-Build, High-Severity-Dependency-Audit und den CI-Konfigurations-Smoke aus.
- Der Critical-Smoke-Job verwendet ein isoliertes PostgreSQL 16, spielt alle Migrationen und den Seed ein und prueft Auth, Launch-Haertung, Landingpage, Gebietsdaten, Checkout, interne Reports, externe GPS-Nachweise und den Beta-Hauptflow.
- `.github/workflows/codeql.yml` analysiert JavaScript/TypeScript bei Pull Requests, Pushes und woechentlich.
- `.github/dependabot.yml` ueberwacht npm- und GitHub-Actions-Abhaengigkeiten woechentlich.
- `tests/ci-config-smoke.mjs` verhindert, dass die zentralen Gates unbemerkt aus den Workflows entfernt werden.

Extern in GitHub noch zu aktivieren:

- Branch-Regel fuer `main`
- erfolgreiche CI- und CodeQL-Checks als Pflichtstatus
- mindestens eine Freigabe fuer Pull Requests, sobald ein zweiter berechtigter Reviewer vorhanden ist
- direkte Force-Pushes und Branch-Loeschung sperren

Die README-Einleitung ist fachlich veraltet und enthaelt gemischte, teilweise ungueltige Zeichenkodierung. Ihre kontrollierte UTF-8-Bereinigung bleibt ein eigenes Dokumentationspaket, damit die umfangreiche Datei nicht durch eine ungezielte Konvertierung beschaedigt wird.

Der Backup-/Restore-Pfad ist als Repository-Paket vorbereitet; die Einrichtung des externen Restic-Ziels und ein echter Staging-Restore bleiben operative Betreiberaufgaben.

### P1 DB-autorisierte Sessions

Das zweite Auth-Haertungspaket wurde umgesetzt:

- `AuthSession` persistiert Ablauf, Widerruf und Login-Kontext mit Cascade-Beziehung zu `User`.
- `getSession()` verifiziert neben der JWT-Signatur die Session in PostgreSQL und liest Status, Rolle und Warehouse-Zuordnung aktuell aus der Datenbank.
- Logout widerruft die aktive Session.
- `tests/auth-session-smoke.mjs` prueft Widerruf, Rollenwechsel und sofortige Sperrwirkung.
- Die CI fuehrt den neuen Auth-Session-Smoke gegen eine frische PostgreSQL-Datenbank aus.

Offen bleiben MFA, Geraeteverwaltung, „Logout aller Geraete“, zentrale Auth-Rate-Limits und eine automatische Bereinigung abgelaufener Sessions.

### P1 Auth-Sitzungsverwaltung

Die aktive Sitzungsverwaltung wurde als begrenztes Self-Service-Paket
ergaenzt:

- `GET /api/auth/sessions` liefert nur eigene, noch gueltige Sitzungen und
  markiert die aktuelle Sitzung.
- `POST /api/auth/sessions` widerruft alle anderen Sitzungen, ohne die
  aktuelle Sitzung zu beenden.
- Der Widerruf wird mit `auth.sessions_revoked` und Request-Kontext
  auditiert. Die JSON-Antwort ist privat und `no-store`.
- `tests/auth-session-management-smoke.mjs` prueft zwei echte Logins, die
  Sitzungsanzeige und die Sperrwirkung auf die zweite Sitzung.

Einzelnes Device-Revoke, MFA, Passwort-Historie und automatische Bereinigung
abgelaufener Sitzungen bleiben bewusst nachgelagerte Haertung.

### P1 Passwort-Reset

Der Passwort-Reset ist als Basispaket umgesetzt:

- `PasswordResetToken` speichert nur einen SHA-256-Hash, Ablaufzeit und Verbrauchszeit.
- Die Anfrage antwortet bei unbekannten und bekannten E-Mail-Adressen gleich und wird pro IP ueber PostgreSQL rate-limitiert.
- Die erfolgreiche Aenderung setzt den Passwort-Hash in einer Transaktion, markiert den Token als verwendet und widerruft alle bestehenden Sessions.
- E-Mail-Versand, Request-ID und Audit-Ergebnis sind an die bestehenden Abstraktionen angebunden.
- `tests/password-reset-smoke.mjs` und `tests/password-reset-live-smoke.mjs` pruefen Struktur, generische Antworten, Hashspeicherung, Einmalverwendung, Session-Revoke und Audit-Kontext.

Offen bleiben MFA, Passwort-Historie, kompromittierte-Passwort-Pruefung und eine zentrale Bounce-/Zustellüberwachung.

### P1 Auth-Abuse-Schutz

Das zentrale Auth-Abuse-Paket wurde anschließend ergänzt:

- `AuthRateLimitBucket` speichert gehashte IP-/Account-Buckets in PostgreSQL und wirkt damit prozessübergreifend.
- Login, Kunden- und Verteilerregistrierung, Verifizierungs-Resend und E-Mail-Verifizierung verwenden `enforceAuthRateLimit()`.
- Überschreitungen liefern `429` mit `Retry-After`; die Limits sind über dokumentierte ENV-Variablen konfigurierbar.
- `tests/auth-abuse-smoke.mjs` und der CI-Critical-Smoke prüfen den Schutz live und statisch.

Offen bleiben CAPTCHA/WAF, externe IP-Reputation und alarmiertes Rate-Limit-Monitoring.

Der oeffentliche Client-Error-Endpunkt verwendet ebenfalls den Scope
`client-error` mit persistentem IP-Limit. Er akzeptiert nur gekuerzte
Fehlerdaten; externe Alarmierung und ein vorgeschalteter Edge-Limiter bleiben
vor dem Launch offen.

### P1 Öffentliche Abuse-Schutzschicht

Lead-Formular und öffentlicher Report-Verifikationscode verwenden jetzt persistente, gehashte IP-Buckets in `PublicRateLimitBucket`. Damit bleibt der Schutz über Prozessneustarts und mehrere App-Instanzen hinweg wirksam. Die konfigurierbaren Grenzwerte stehen in `.env.example` und `.env.production.example`; die Retention berücksichtigt beide Bucket-Typen.
