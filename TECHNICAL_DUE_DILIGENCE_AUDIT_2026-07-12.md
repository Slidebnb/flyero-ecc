# FLYERO Technical Due Diligence und Sicherheits-Audit

Stand: 12.07.2026

Pruefobjekt: `C:\Users\Administrator\ecc`

Branch: `main`

Pruef-Commit: `f7d6c65b4381212ecff500a622d7ee4e156c0485`

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

FLYERO ist kein einfacher Landingpage-MVP mehr. Das Repository enthaelt einen breiten Next.js-Monolithen mit 70 Prisma-Modellen, 55 Enums, 182 API-Routen, 90 Seiten, 31 Migrationen und 46 Smoke-Testdateien. Auftrag, Checkout, Rechnung, Lager, Dispatch, Tour, externe GPS-Nachweise, Reports, CRM, Monitoring, E-Mail-Queue und mehrere Rollen sind fachlich abgebildet.

Der aktuelle Stand ist dennoch noch kein belastbares Multi-Tenant-SaaS und nicht ISO-27001- oder SOC-2-ready. Der wichtigste strukturelle Befund ist nicht ein einzelner Bug, sondern die fehlende Mandantenebene: Es gibt kein `Tenant`-, `Organization`- oder vergleichbares Modell und keine `tenantId`-Pflicht auf Geschaeftsdaten. Kundenkonten sind voneinander ueber Profil- und User-Beziehungen getrennt, aber das ist keine echte Unternehmens-/Mandantenarchitektur.

Die groessten aktuellen Risiken sind:

1. `P0` Produktionsdaten und Uploads liegen operativ weiterhin ohne nachgewiesenen automatischen Offsite-Backup- und Restore-Nachweis.
2. `P0` Die Plattform ist nicht mandantenfaehig, obwohl das Zielbild dies verbindlich fordert. Eine spaetere Nachruestung betrifft nahezu jedes Kernmodell und jede Abfrage.
3. `P1` Uploads sind signaturgeprueft und privat speicherbar, aber Malware-Scan, Quarantaene, Altbestandsmigration und ein produktiver S3-Nachweis fehlen.
4. `P1` Stripe-Reconciliation, signierte Staging-Abnahmetests, Dispute-Prozess und getrennte Live-/Staging-Betriebsnachweise fehlen.
5. `P1` Externes Monitoring, Alarmierung, zentrale Request-Korrelation und Uptime-/Backup-Ueberwachung fehlen weiterhin.
6. `P1` AuditLogs haben jetzt Kontextfelder, aber noch keine Tenant-ID, keine vollstaendige Anbindung aller kritischen Aktionen und kein extern manipulationsgeschuetztes Archiv.
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
| Tests | 46 Node-Smoke-Skripte, einschliesslich Auth-, Storage-, Permission- und Report-Smokes | teilweise |
| CI/CD | GitHub Actions fuer Prisma, Lint, Build, Security und kritische PostgreSQL-Smokes | vorhanden im Repo; Branch-Schutz/Staging extern offen |

### Architekturstaerken

- Fachlogik liegt haeufig in `src/lib/*` und nicht nur in UI-Komponenten.
- API-Routen verwenden ueberwiegend zentrale Auth- und Fehlerhelfer.
- Prisma-Migrationen sind versioniert; aktuell liegen 26 Migrationsverzeichnisse vor.
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

- 67 Modelle und 55 Enums bilden Order, Payment, Invoice, Warehouse, Dispatch, Tour, GPS, Report, Dokumente, CRM, Notifications, Monitoring und Audit ab.
- Fremdschluessel, Indizes, eindeutige Constraints und Zeitstempel sind an vielen Kernmodellen vorhanden.
- Stripe-Event-IDs sind eindeutig, Reportnummern und Verifikationscodes sind eindeutig.
- Migrationen sind versioniert und werden im Deployment mit `prisma migrate deploy` angewendet.

### Kritische Luecken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| DB-01 | Kein `Tenant`/`Organization`-Modell und keine durchgaengige `tenantId` | P0 | Mandantenmodell als eigene Architekturphase entwerfen; alle geschaeftlichen Modelle, Unique-Constraints, Indizes und Zugriffsregeln migrieren. |
| DB-02 | Viele fachliche Snapshots und Metadaten liegen als freies `Json` vor | P2 | JSON nur fuer unveraenderliche Snapshots behalten; haeufig abgefragte oder sicherheitsrelevante Felder typisieren. |
| DB-03 | Soft Delete und Loesch-/Sperrkonzept sind nicht einheitlich | P2 | Datenklassen definieren und pro Modell `deletedAt`, Archivierung oder harte Loeschung verbindlich festlegen. |
| DB-04 | Keine dokumentierte Datenaufbewahrung oder automatische Bereinigung | P1 | Retention-Jobs fuer GPS, Fotos, Logs, Tokens und temporaere Dateien mit Legal-Hold-Ausnahmen einfuehren. |
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
| AUTH-01 | JWT enthaelt Rolle und Warehouse-ID bis zu sieben Tage; `requireRole()` prueft nicht erneut die DB | P1 | Serverseitige Session-Tabelle oder DB-autorisierte Session-Rekonstruktion einfuehren; Sperrung/Rollenwechsel sofort wirksam machen. |
| AUTH-02 | Keine Session-Revoke-Liste, keine Geraete-/Sessionverwaltung | P1 | Session-IDs, Rotation, Logout aller Geraete und Admin-Revoke einfuehren. |
| AUTH-03 | Kein zentraler Login-/Register-/Resend-Rate-Limiter | P1 | Redis- oder DB-gestuetzten Rate-Limiter mit IP-, Account- und Device-Buckets einsetzen. |
| AUTH-04 | Keine MFA-Unterstuetzung | P2 | TOTP/WebAuthn fuer Admin, Support, Buchhaltung und spaetere Enterprise-Kunden vorbereiten. |
| AUTH-05 | Passwort-Reset war im urspruenglichen Stand nicht vorhanden | P1 erledigt als Basispaket | Einmal-Token, 30-Minuten-Ablauf, DB-Rate-Limit, Session-Revoke, generische Antwort, E-Mail und AuditLog umgesetzt; MFA, Passwort-Historie und kompromittierte-Passwort-Pruefung bleiben offen. |
| AUTH-06 | Kein ausdruecklicher CSRF-Token-/Origin-Pruefmechanismus | P2 | Fuer mutierende Cookie-Requests Origin/Referer pruefen oder CSRF-Token einfuehren. |

## 6. Mandantentrennungsanalyse

Status: `fehlt als Architektur`, `teilweise als Kunden-Eigentumspruefung`.

Aktuell werden Kundenobjekte meist ueber `CustomerProfile.userId`, `customerId` oder verschachtelte Order-Beziehungen eingeschraenkt. Das verhindert in vielen gesichteten Kundenrouten den direkten Zugriff auf fremde Auftraege oder Reports. Es gibt jedoch keine Unternehmensmitgliedschaften, keine Mandantenrollen und keine zentrale Tenant-Policy.

Konsequenzen:

- Ein Unternehmen kann nicht sauber mehrere Mitarbeiter mit unterschiedlichen Rechten verwalten.
- Globale Unique-Constraints koennen spaeter mandantenspezifische Anforderungen blockieren.
- Jede einzelne Query muss weiterhin individuell korrekt auf User/Customer gescoped werden.
- Admin ist plattformweit und nicht zwischen Plattform-, Unternehmens- und Supportrechten getrennt.
- Dateien und Storage-Keys enthalten keine Mandantenpartition.

Empfohlene Zielstruktur vor weiteren Enterprise-Funktionen:

- `Tenant`
- `TenantMembership`
- zentrale Permission-Codes statt nur grober Rollen
- `tenantId` auf allen mandantenbezogenen Kernmodellen
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
| RBAC-01 | Rollen sind grob; keine zentralen Permissions | P1 | Permission-Matrix fuer Lesen, Erstellen, Aendern, Freigeben, Export und Mitarbeiterverwaltung einfuehren. |
| RBAC-02 | Admin und Support/Dispatcher teilen viele Hochrisiko-Aktionen | P1 | Payment-Refund, Report-Publish, Nutzerverwaltung und Exporte getrennt berechtigen. |
| RBAC-03 | Kein Plattform-Superadmin vs. Unternehmensadmin | P1 | Im Zuge der Tenant-Architektur Rollenebenen trennen. |
| RBAC-04 | Middleware vertraut der Rolle im JWT | P1 | Middleware nur fuer Navigation verwenden; API-Policy aus aktueller DB-Mitgliedschaft ableiten. |
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
| SEC-01 | Kein verteilter Abuse-Schutz fuer Auth und oeffentliche APIs | P1 | Zentralen Rate-Limiter und Account-Lockout/Backoff einfuehren. |
| SEC-02 | Lead-Rate-Limit lebt nur in einer Prozess-Map | P2 | Bei Neustart oder mehreren Instanzen wirkungslos; Redis/DB verwenden. |
| SEC-03 | Security-Header unvollstaendig | P1 | HSTS, CSP, Permissions-Policy und eine klare Cross-Origin-Policy ergaenzen. |
| SEC-04 | Uploadvalidierung verlaesst sich auf Endung/MIME-Angabe | P1 | Magic-Byte-Pruefung, Quarantaene, Malware-Scan und Content-Disposition-Haertung einfuehren. |
| SEC-05 | `svg`, Office-, ZIP- und Adobe-Dateien sind erlaubt | P1 | Aktive Inhalte nie inline ausliefern; Scan- und Download-Policy je Dateiklasse definieren. |
| SEC-06 | Fuenf moderate Dependency-Advisories | P2 | Prisma/Next-Updates kontrolliert testen; kein blindes `npm audit fix --force`. |
| SEC-07 | Keine automatischen SAST-, Secret- oder Dependency-Scans | P1 | GitHub Actions mit CodeQL, Dependency Review und Secret Scanning einrichten. |
| SEC-08 | Keine externe Penetrationspruefung | P1 vor Launch | Scope und Abnahme fuer Auth, Upload, Payments, IDOR und Adminpfade beauftragen. |

## 9. Datenschutzanalyse

Betroffene personenbezogene Daten umfassen Kontaktdaten, Rechnungsadressen, Verteilerprofile, GPS-Punkte, Foto-Metadaten, Supportkommunikation, IP-/User-Agent-Daten soweit spaeter erfasst sowie Zahlungsreferenzen.

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| DSGVO-01 | Keine technische Retention-/Loeschautomatik | P1 | Verzeichnis der Verarbeitungstaetigkeiten in technische Retention-Regeln ueberfuehren. |
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
| PAY-02 | Kein automatischer Reconciliation-Job | P1 | Stripe-Zahlungen regelmaessig gegen interne Payment-/Order-Stati abgleichen. |
| PAY-03 | Mock-Mechanismus bleibt im produktiven Code | P2 | Explizite Build-/Runtime-Grenze und Deployment-Check fuer `ENABLE_MOCK_PAYMENTS=false`. |
| PAY-04 | Kein dokumentierter Chargeback-/Dispute-Prozess | P1 | Dispute-Events, Sperrlogik, Audit und operative Verantwortlichkeit ergaenzen. |
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
| FILE-01 | Storage liegt lokal in Docker-Volumes | P0 | S3-kompatiblen privaten Objekt-Storage mit Versionierung, Lifecycle und Offsite-Backup einfuehren. |
| FILE-02 | Keine Magic-Byte-/Malware-Pruefung | P1 | Quarantaene-Pipeline und Scanstatus vor Freigabe einfuehren. |
| FILE-03 | Keine ablaufenden Download-Tokens | P2 | Autorisierte Proxy-Downloads beibehalten oder kurzlebige signierte URLs verwenden. |
| FILE-04 | `DocumentVersion` verweist auf aktuelle geschuetzte Route, aber alte Binaerdateien werden nicht separat adressiert | P1 | Jede Version braucht einen unveraenderlichen Storage-Key; Versionsdownload muss exakt diese Datei liefern. |
| FILE-05 | Generierte Reports/Rechnungen liegen privat, aber Legacy-Read fuer `public/generated` bleibt | P2 | Legacy-Artefakte migrieren und Legacy-Pfad nach erfolgreicher Migration entfernen. |
| FILE-06 | Eigene Browser-GPS-Funktion existiert weiter, garantiert aber kein Background-Tracking | P2 | Produktcopy und Betrieb strikt beim externen GPS-MVP halten; Eigen-Tracking nur als nicht garantiertes Zusatzsystem. |
| FILE-07 | Keine dokumentierte GPS-/Foto-Loeschfrist | P1 | Zweckgebundene Retention und automatische Loeschung definieren. |
| FILE-08 | Der generische Dokumentservice erzeugt ohne Datei oder Inhalt einen synthetischen `FLYERO placeholder upload` | P1 | Leere Uploads strikt ablehnen; produktive Dokumente duerfen nie aus Ersatzinhalt erzeugt werden. |

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
| REP-02 | Report-Erzeugung sendet teils bereits vor finaler Veroeffentlichung eine Verfuegbarkeitsnachricht | P1 | Benachrichtigungen ausschliesslich an kundenrelevante Statusuebergaenge koppeln. |
| REP-03 | Snapshot-Versionierung ist vorhanden, aber Korrektur-/Altversionsansicht nicht vollstaendig operationalisiert | P2 | Unveraenderliche Versionen, aktuelle Version und interne Historie getrennt ausliefern. |
| REP-04 | Oeffentlicher Verify-Endpunkt gibt Reportmetadaten nach Code preis | P2 | Rate-Limit, minimale Felder und keine Protokollierung des vollen Codes in frei lesbaren Metadaten sicherstellen. |

## 13. Testanalyse

### Ist-Stand

- 34 `.mjs`-Testdateien.
- Rund 618 Assert-Aufrufe in den vorhandenen Tests.
- Modulspezifische Smoke-Tests fuer Auth, Orders, Payments, Reports, Lager, Maps und UI-Quelltextregeln.
- Build und Lint sind als lokale Gates vorhanden.

### Bewertung

Die Testlandschaft ist fuer eine kontrollierte Beta wertvoll, ist aber kein vollstaendiges Unit-/Integration-/E2E-System. Viele Tests pruefen Quelltextmuster oder einen gemeinsam gestarteten Dev-Server. Es fehlen nachweisbare Coverage-Metriken, isolierte Unit-Tests, echte Browser-E2E-Flows in CI, Lasttests und systematische Security-Negativtests.

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| TEST-01 | Keine CI-Ausfuehrung | P1 | Kritische Tests, Prisma-Validierung, Lint und Build bei jedem PR ausfuehren. |
| TEST-02 | Keine Coverage-Messung | P2 | Unit-/Integrationstest-Runner und Coverage-Grenzen fuer kritische Services einfuehren. |
| TEST-03 | Keine vollstaendige Tenant-Negativmatrix | P0 mit Tenant-Einfuehrung | Ressourcentypen zwischen Tenant A/B automatisiert gegeneinander testen. |
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

### Risiken

| ID | Befund | Prioritaet | Massnahme |
| --- | --- | --- | --- |
| OPS-01 | Keine automatischen, verschluesselten Offsite-Backups | P0 | Taegliche DB- und Storage-Backups ausserhalb des Servers, Aufbewahrung und Alarmierung einrichten. |
| OPS-02 | Kein dokumentierter und geuebter Restore | P0 | Restore-Runbook und regelmaessigen Restore-Test mit Nachweis einfuehren. |
| OPS-03 | Single-Server-/Single-Postgres-Betrieb | P2 | Vor Skalierung Managed DB oder replizierte Zielarchitektur, Wartungsfenster und RTO/RPO definieren. |
| OPS-04 | Keine GitHub Actions, Staging- oder Preview-Umgebung | P1 | PR-Gates, Staging-Deployment und getrennte Secrets einrichten. |
| OPS-05 | Kein externes Error-/Uptime-/Performance-Monitoring | P1 | Uptime-Check, Error Tracking, Metriken und Alarmwege einrichten. |
| OPS-06 | Keine Request-ID in allen Logs | P1 | Request-ID am Edge erzeugen und durch API, Audit, ErrorLog und Jobs propagieren. |
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

- `BETA_RELEASE_CHECKLIST.md` und `KNOWN_ISSUES.md` enthalten veraltete Aussagen, etwa dass NotificationQueue keine echten E-Mails verschickt oder generierte Artefakte noch oeffentlich liegen.
- Mehrere Dokumente und UI-Strings zeigen Encoding-Fehler wie `fÃ¼r` statt `fuer`/`für`.
- Es fehlen eine aktuelle Systemarchitektur, API-Spezifikation, Permission-Matrix, Incident-Response, Backup-/Restore-Runbook, Release-Prozess, Vendor-Matrix und Datenklassifikation.
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
3. Tenant-Zielarchitektur als eigenes Design festlegen, bevor weitere Unternehmens-/Enterprise-Funktionen entstehen.
4. Produktion pruefen: `ENABLE_MOCK_PAYMENTS=false`, echte E-Mail-/Stripe-Secrets getrennt, keine Demo-Seeds.

### Vor oeffentlichem Launch

1. DB-autorisierte Sessions mit sofortiger Sperr-/Rollenwirkung.
2. Zentraler Rate-Limiter fuer Login, Registrierung, Verifizierung, Leads und Verify-Endpunkte.
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

1. Tenant-Migration vollstaendig umsetzen.
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
8. Tenant-Architekturdesign und schrittweise Migration
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
- Es wurden in dieser Auditphase keine produktiven Code-, Schema-, Datenbank- oder Port-Aenderungen vorgenommen.

## 21. Naechster Gate

Der naechste sinnvolle Umsetzungsschritt ist kein weiteres Fachmodul. Zuerst werden die P0-/P1-Grundlagen in getrennten, pruefbaren Paketen umgesetzt. Paket 1 sollte `Backup/Restore und Betriebsnachweis` sein; Paket 2 `DB-autorisierte Sessions und zentraler Auth-Abuse-Schutz`.

## 22. Umsetzungsfortschritt nach dem Audit

### Aktueller Abgleich nach den Folgepaketen

Der Auditbericht wurde nach dem ursprünglichen Prüflauf weitergeführt. Folgende Befunde sind inzwischen nachweisbar verändert:

- **DB-autorisierte Sessions: vorhanden.** `AuthSession` prüft Ablauf, Widerruf und den aktuellen Benutzerstatus sowie die aktuelle Rolle aus PostgreSQL.
- **Auth-Abuse-Schutz: vorhanden als DB-gestützter Basisschutz.** Login, Registrierung, Verifizierungs-Resend und E-Mail-Verifizierung verwenden gehashte IP-/Account-Buckets. CAPTCHA, WAF, IP-Reputation und automatische Bucket-Bereinigung bleiben offen.
- **Security-Header: vorhanden.** Caddy setzt HSTS, CSP, Permissions-Policy, `nosniff`, `X-Frame-Options` und `Referrer-Policy`; Next.js deaktiviert `X-Powered-By`.
- **CI/Security-Gates: vorhanden im Repository, extern noch zu aktivieren.** GitHub Actions prüfen Prisma, Lint, Build, kritische Smokes, CodeQL und Dependabot. Branch-Schutz und verpflichtende Checks sind GitHub-Repository-Einstellungen und nicht allein aus dem Code ableitbar.
- **Upload-Prüfung: teilweise vorhanden.** Bekannte PDF-, Bild-, Archiv- und XML-Typen werden zusätzlich zur Endung über Signaturen bzw. XML-Anfang geprüft; JSON-Uploads benötigen echte Base64-Dateiinhalte; Tour-Fotos akzeptieren nur PNG/JPG/WEBP. Malware-Scan, Quarantäne und privater Objekt-Storage fehlen weiterhin.
- **Placeholder-Uploads: behoben.** Der Dokumentservice lehnt fehlende oder leere Inhalte ab und erzeugt keinen synthetischen Ersatzinhalt mehr.
- **Dokumentversionen: verbessert.** `DocumentVersion.storageKey` speichert für neu erzeugte Dateien den unveränderlichen privaten Storage-Key. Versionsdownloads lesen exakt diese Version; historische Versionen ohne nachweisbaren Key bleiben bewusst nicht abrufbar.
- **Premium-Preislogik: vorhanden.** Die marginale Staffel und der Mindestauftrag von 599 EUR netto sind als `premium-distribution-v4` versioniert und werden über Gebiet-/Checkout-Smokes mit Schwellenfallprüfungen verifiziert.
- **Zentrale Permission-Matrix: teilweise vorhanden.** `src/lib/permissions.ts` definiert die ersten maschinenlesbaren Berechtigungen. Finanz-, Preis-, Nutzer- und Veröffentlichungsaktionen sind serverseitig auf `ADMIN` begrenzt; operative Reportprüfung und Analytics-Lesen sind für Support/Disposition getrennt freigegeben. Der Tenant-Scope und die vollständige Migration aller APIs bleiben offen.
- **Ephemerer Retention-Prozess: als kontrollierter Dry-Run vorhanden.** `scripts/retention.mjs` berechnet und bereinigt nach ausdrücklicher Aktivierung abgelaufene Verifizierungstoken, alte Sessions und inaktive Rate-Limit-Buckets. GPS-, Foto-, Dokument-, Audit- und Rechnungsdaten werden bewusst nicht generisch gelöscht, solange Zweckbindung, gesetzliche Fristen und Legal Hold nicht fachlich freigegeben sind.
- **Privater Object-Storage-Pfad: technisch vorbereitet, operativ noch offen.** `src/lib/privateObjectStorage.ts` bündelt lokale und S3-kompatible private Ablage für Dokumente sowie generierte Dateien. Lokal bleibt der Entwicklungsfallback aktiv; Produktion muss Bucket, Verschlüsselung, Versionierung, Lifecycle, initiale Migration und Restore-Test noch nachweisen.

Damit sind die früheren Befunde `AUTH-01`, `AUTH-03`, `SEC-03`, `SEC-07` und `FILE-08` nicht mehr als unverändert fehlend zu bewerten. `SEC-04` und `FILE-04` sind teilweise beziehungsweise durch die Folgeänderung für neu erzeugte Versionen behoben; Quarantäne, Malware-Scan und Altbestandsmigration bleiben offen.

### P1 AuditLog-v2

Der AuditLog-Kontext wurde als begrenzte, rueckwaertskompatible Erweiterung umgesetzt:

- `requestId`, `ipAddress`, `userAgent` und `result` sind nullable beziehungsweise mit `SUCCESS` vorbelegt, damit historische Eintraege migrierbar bleiben.
- `src/lib/auditRequestContext.ts` uebernimmt nur eine begrenzte Request-ID, den ersten Proxy-IP-Wert und maximal 512 Zeichen User-Agent. Passwoerter, Cookies, Tokens und Request-Bodies werden nicht gespeichert.
- Login und Logout schreiben den Request-Kontext mit. Bestehende Service-Aufrufe bleiben ohne kuenstliche Nachruestung kompatibel.
- `tests/audit-log-v2-smoke.mjs` und der CI-Critical-Smoke pruefen Schema, Migration, Sanitization und die beiden Auth-Routen.

Noch offen sind Tenant-ID, die Anbindung von Zahlungs-/Webhook-/Dokument-/Report-Aktionen sowie ein externes, manipulationsgeschuetztes Logziel mit verbindlicher Aufbewahrung.

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

Offen bleiben CAPTCHA/WAF, externe IP-Reputation, alarmiertes Rate-Limit-Monitoring und ein Retention-Job für alte Buckets.
