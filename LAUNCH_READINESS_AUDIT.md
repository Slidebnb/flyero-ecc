# FLYERO Launch-Readiness-Audit

Stand: 2026-07-15  
Gepruefter Commit: `50986fb` (`codex/module-27-1-runtime-closure`, identisch zu `origin/main`)  
Scope: Umsatzkern, Gebietsauswahl, Preis/Bestellung, Zahlung, Druckdaten, Nachweise, E-Mail und Produktionsbetrieb.

## Kurzurteil

Der Kern ist technisch weit fortgeschritten, aber noch nicht fuer einen unkontrollierten offenen Direktzahlungs-Launch freigegeben.

**Bereits belastbar:**

- Bestellung wird serverseitig neu berechnet und gegen einen Quote-Fingerprint geprueft.
- Preis, MwSt. und Zahlungsbetrag werden aus dem serverseitigen Pricing-Service abgeleitet.
- Stripe Checkout und signierter Webhook sind vorhanden; doppelte Webhook-Ereignisse werden erkannt.
- Dateien liegen hinter geschuetzten Downloads und werden im Produktionsmodus gescannt.
- Externe GPS-Berichte koennen hochgeladen, geprueft und erst danach fuer den Kunden veroeffentlicht werden.
- Kunden-, Admin- und Tenant-Berechtigungen sind in den relevanten Kernpfaden vorhanden.

**Vor Direktzahlungen zwingend zu schliessen:**

1. Der Produktionsversand der E-Mail-Queue muss automatisch laufen. `createNotification()` stellt Nachrichten nur zu; im Compose gibt es keinen Worker.
2. Auch ein einzelnes Gebiet ohne passendes aktives Lager muss serverseitig auf manuelle Pruefung gehen. Aktuell wird `warehouseMatch` fuer Einzelgebiete berechnet, aber nicht in `needsManualReview` einbezogen.
3. Der Druckservice darf nicht wie ein fertiger Online-Artikel bezahlt werden, solange Papierstaerke, Farbmodus, Falzung, Druckpreis und die Druckdatei nicht Bestandteil der verbindlichen Quote sind.
4. Die Haushaltszahl ist ohne offizielle oder lizenzierte Quelle eine Schaetzung. Eine Genauigkeit von 99 Prozent ist mit der aktuellen Flaechen-/Dichteformel nicht belegbar.

Bis diese Punkte geschlossen sind, ist der sinnvollste kommerzielle Start: **deutschlandweit Anfragen annehmen**, Direktzahlung nur fuer Gebiete mit aktivem Logistik-Match und fuer vorhandene Kundenflyer aktivieren, Druckservice als gepruefte Anfrage behandeln.

## Befundmatrix

| Bereich | Status | Risiko | Repo-Nachweis | Bewertung |
| --- | --- | --- | --- | --- |
| PLZ-/Ortsuche | teilweise bestaetigt | hoch | `src/lib/smartMaps.ts`, `src/app/api/public/planner/geocode/route.ts`, `src/app/api/public/planner/autocomplete/route.ts` | Google-Server-Geocoding ist fuer Deutschland vorbereitet. Bei fehlender/fehlerhafter Google-Konfiguration gibt es im oeffentlichen Planer keinen belastbaren Ersatz, sondern einen Fehler. |
| Stadt-/PLZ-Grenzen anklicken | teilweise bestaetigt | hoch | `src/app/customer/orders/new/SmartOrderWizard.tsx` | `POSTAL_CODE` und `LOCALITY` werden ueber Data-driven styling verwendet, aber nur mit Browser-Key plus Map-ID und verfuegbarer Boundary-Layer. Ohne diese Konfiguration bleibt Zeichnen der sichere Weg. |
| Gebiet deutschlandweit | teilweise bestaetigt | hoch | `src/lib/smartMaps.ts` | Geocoding kann deutschlandweit arbeiten. Operative Zustellung ist aber nur dort direkt belastbar, wo ein aktives Lager bzw. eine Region matcht. |
| Haushalte | bestaetigt, aber nur als Schaetzung | blocker fuer 99%-Versprechen | `src/lib/smartMaps.ts` | Ohne offizielle/lizenzierte Daten wird `estimateHouseholds()` mit Dichtewerten verwendet; das ist keine 99%-Quelle. UI kennzeichnet es als geschaetzt, darf aber nicht als exakt verkauft werden. |
| Preis | bestaetigt | hoch | `src/lib/pricing.ts`, `src/app/api/customer/orders/route.ts`, `src/lib/payments.ts` | Quote, Auftrag und Checkout berechnen serverseitig. Snapshot und Pricing-Signatur werden gespeichert. |
| Quote-Stabilitaet | bestaetigt | hoch | `src/app/api/customer/orders/route.ts`, `src/lib/planningQuote.ts` | Veraltete Fingerprints werden mit 409 abgewiesen. Das verhindert, dass eine alte sichtbare Quote bezahlt wird. |
| Bestellung | bestaetigt | hoch | `src/app/api/customer/orders/route.ts` | Inquiry und Direktbuchung werden gespeichert; Status und Snapshot werden gesetzt. Nachgelagerte Lagerzuweisung liegt jedoch ausserhalb der Order-Transaktion. |
| Einzelgebiet-Lagergate | fehlerhaft | blocker | `src/lib/smartMaps.ts` | `needsManualReview` prueft aktuell nur `areaSelection` mit Segmenten. Das einzelne `warehouseMatch` wird fuer diesen Gate nicht verwendet. Dadurch kann ein Einzelgebiet ohne aktive Logistik zu frueh als zahlbar erscheinen. |
| Mehrgebiete | teilweise bestaetigt | hoch | `src/lib/orderSegments.ts`, `prisma/schema.prisma`, `src/app/api/customer/orders/route.ts` | Segmente, Aggregation, getrennte Lagerzuordnung und Dispatch sind vorhanden. Die Gesamtquote bleibt eine Kampagnenquote. |
| Eigene Flyer | teilweise bestaetigt | hoch | `src/app/customer/orders/new/SmartOrderWizard.tsx`, `src/lib/orderApproval.ts` | Bestellung, Anlieferung und Lagerprozess sind vorhanden. Das UI zeigt aber weiterhin das Flyerformat, obwohl es fuer eigene fertige Flyer nicht kaufentscheidend ist. |
| Druckservice | unvollstaendig | blocker | `src/app/customer/orders/new/SmartOrderWizard.tsx`, `src/lib/documents.ts`, `src/lib/orderApproval.ts` | Online wird nur der Verteilpreis berechnet. Der spaetere PrintOrder wird mit Standardpapier, 80 g, 4/4 und Standarddetails angelegt; echte Druckkonditionen sind als `manual_later` markiert. Das darf nicht als fertig bezahlter Druckverkauf erscheinen. |
| Druckdatei | unvollstaendig | hoch | `src/app/customer/orders/new/SmartOrderWizard.tsx`, `src/lib/documents.ts` | `UPLOADED` kann im Wizard gewaehlt werden, ohne dass dort eine Datei mit der Order verknuepft wird. Upload spaeter funktioniert ueber das Kundenportal, aber der Statusname ist im Wizard zu stark. |
| Stripe Checkout | bestaetigt | blocker-relevant | `src/lib/payments.ts`, `src/app/api/payments/checkout/route.ts` | Checkout wird mit aktuellem Betrag angelegt, bezahlt wird erst nach Profilpruefung. Live-Betrieb und echte Karte wurden in diesem Repo-Audit nicht mit einem Live-Testbetrag verifiziert. |
| Stripe Webhook | bestaetigt | blocker-relevant | `src/app/api/stripe/webhook/route.ts`, `src/lib/payments.ts` | Signatur, Event-Speicherung und Duplicate-Schutz sind vorhanden. Produktion muss den Webhook von Stripe mit `whsec_...` erreichen koennen. |
| Nachweis-Upload | bestaetigt | hoch | `src/app/api/admin/orders/[id]/evidence/route.ts`, `src/lib/externalEvidence.ts` | PDF, GPX/KML/KMZ und Fotos werden privat gespeichert, gescannt und dem Auftrag zugeordnet. |
| Manuelle Verteiler | teilweise bestaetigt | hoch | `src/lib/externalEvidence.ts`, `src/app/admin/orders/[id]/page.tsx` | Das Adminformular akzeptiert einen manuellen Namen, der Report-Tour-Unterbau verlangt fuer eine neue Tour aber weiterhin einen vorhandenen freigegebenen DistributorProfile. Der manuelle Name wird danach nur als Zusatzdatensatz angelegt. |
| Report-Freigabe | bestaetigt | hoch | `src/lib/reports.ts` | Unveroeffentlichte Nachweise bleiben unsichtbar. Veroeffentlichung verlangt Snapshot und freigegebene Dokumente. |
| Kunden-E-Mail bei Report | teilweise bestaetigt | blocker | `src/lib/reports.ts`, `src/lib/notifications.ts`, `src/lib/notificationWorker.ts` | Bei Veroeffentlichung wird die E-Mail korrekt gequeued. In `docker-compose.production.yml` laeuft aber kein dauerhafter Queue-Worker. Ohne externen Scheduler kommt die Mail nicht automatisch raus. |
| Registrierungs-/Status-E-Mail | teilweise bestaetigt | hoch | `src/lib/notifications.ts`, `src/lib/notificationWorker.ts` | Erstellung und Queue sind vorhanden. Provider und reale Zustellung muessen auf Hetzner mit einem echten Testempfaenger verifiziert werden. |
| Interner Queue-Endpunkt | unvollstaendig | hoch | `src/app/api/internal/notifications/process/route.ts`, `.env.production.example`, `scripts/production-preflight.mjs` | Der Endpunkt verlangt `INTERNAL_API_TOKEN`, aber das Production-Preflight erzwingt diesen Schluessel aktuell nicht. |
| Datei-/S3-Schutz | bestaetigt | hoch | `src/lib/documents.ts`, Storage-/Privacy-Smoke-Tests | Produktionspfad ist auf privates S3, Scan und geschuetzte Downloads ausgelegt. S3-Zugriff und Restore muessen trotzdem auf dem echten Server getestet werden. |
| Demo-Daten in Produktion | teilweise bestaetigt | hoch | `src/lib/productionData.ts`, `src/lib/smartMaps.ts` | Viele Produktionsfilter existieren. Die zentrale `matchingAreas`-Abfrage in `getOrderIntelligence()` verwendet jedoch nicht sichtbar `productionAreaWhere()`. Vor Launch muss ausgeschlossen werden, dass alte Seed-Gebiete in Produktionsquoten einfliessen. |
| UI-/Encoding-Qualitaet | fehlerhaft | mittel | `src/app/customer/orders/new/SmartOrderWizard.tsx` und weitere Treffer | Im Quelltext stehen weiterhin sichtbare Mojibake-Folgen wie `Ãœ`, `Ã¼` und `kmÂ²`. Das ist kein Umsatz-Blocker, aber nicht launchreif fuer Kunden. |
| Maps-Abuse-Schutz | teilweise bestaetigt | mittel | `tests/maps-abuse-smoke.mjs` | Rate-Limit-Code ist vorhanden. Der lokale Testserver konnte in dieser Umgebung auf Port 3044 nicht starten; das ist ein Test-Setup-Problem, kein bestaetigter Produktionsfehler. |
| Build/TypeScript/Lint | bestaetigt | mittel | aktuelle Checks | Build, `tsc` und ESLint waren gruen. |

## Was der Kunde wirklich braucht

Der Nutzer will keine Plattformnavigation, sondern eine schnelle Entscheidung:

1. **Wo soll verteilt werden?** PLZ, Ort oder Adresse eingeben; Google schlägt den Ort vor; auf der Karte PLZ-/Ortsgrenze anklicken oder selbst zeichnen; weitere Gebiete über „Gebiet hinzufügen“.
2. **Wie viele Flyer?** Haushaltszahl sichtbar als „geschätzt“ oder „aus geprüfter Quelle“; empfohlene Flyerzahl mit Reserve; Menge anpassen.
3. **Wer liefert die Flyer?**
   - „Ich liefere fertige Flyer an“: Druckformat, Papier und Falzung ausblenden; nur Lieferhinweise und optionale Druckdatei.
   - „FLYERO druckt“: Format, Papier, Farbe, Seiten, Falzung und Datei erfassen; solange der Druckpreis nicht kalkuliert ist, Anfrage/Angebot statt sofortiger Zahlung.
4. **Wann?** Frühester Start ab sieben Tagen; Wunschzeitraum optional flexibel.
5. **Prüfen und abschliessen:** eine klare Netto-/MwSt.-/Brutto-Zusammenfassung, Gebietsdatenbasis, Logistikstatus und genau eine Hauptaktion.

Die Hauptaktion sollte nie eine technische Fehlermeldung sein. Wenn das Gebiet noch nicht operativ versorgt ist, lautet der Weg verständlich: **„Gebiet prüfen lassen“**. Wenn die Daten und das Lager passen: **„Jetzt buchen und bezahlen“**. Eine Anfrage bleibt deutschlandweit moeglich.

## Vergleichbare Muster aus professionellen Produkten

- Booking-artige flows beginnen mit den wenigen kaufentscheidenden Angaben und zeigen danach sofort die verfuegbaren Optionen. Fuer FLYERO heisst das: Gebiet und Zeitraum zuerst, nicht interne Druck-/Logistikfelder.
- Google Ads fuehrt neue Nutzer ueber Ziel, Kampagneneinstellungen und erst danach zur Zahlungsinformation. Dieses Muster passt fuer FLYERO: Zielgebiet/Leistung, Ausfuehrungsdetails, Quote, Zahlung.
- Google empfiehlt fuer Adressflows Autocomplete plus Geocoding und eine visuelle Kartenbestaetigung. Das reduziert Tipparbeit, ersetzt aber keine lizenzierte Haushaltsdatenquelle.
- Stripe weist darauf hin, dass die Erfuellung nicht allein vom Success-Redirect abhaengen darf; der Webhook ist die verbindliche Zahlungsquelle. FLYERO hat diesen Unterbau bereits, muss ihn aber mit einem realen Live-Test und Monitoring belegen.

## Launch-Plan ohne weitere Feature-Revolution

### Gate 0: Produktionsbeweis

- Hetzner: `node scripts/production-preflight.mjs` im App-Container erneut ausfuehren.
- E-Mail: Testregistrierung, Passwort-Reset und Report-Publikation an eine echte Empfaengeradresse pruefen.
- Stripe: eine kleine Live-Testzahlung mit Rueckzahlung durchfuehren; Webhook-Event, Payment, Order, Rechnung und Benachrichtigung korrelieren.
- Google: mehrere echte PLZ aus Nord, Sued, Ost und West testen; Autocomplete, Geocoding, Karte und Boundary-Klick getrennt bestaetigen.
- Backup: Restore-Test aus dem echten Restic-/S3-Ziel dokumentieren.

### Gate 1: Vier Code-Blocker

1. Einzelgebiet ohne aktives Lager auf manuelle Pruefung setzen; Seed-Gebiete in jeder Produktions-Quote ausschliessen.
2. E-Mail-Worker als belastbaren Systemd-Timer oder separaten Produktionsdienst installieren und `INTERNAL_API_TOKEN` in Example/Preflight dokumentieren und erzwingen.
3. Druckservice entweder vollstaendig quotieren oder im Direktzahlungsweg sperren; eigene Flyer muessen den Druckdatenblock nicht zeigen.
4. Haushaltsquelle im UI und im Checkout konsequent unterscheiden; keine 99%-Aussage ohne offizielle/lizenzierte Quelle.

### Gate 2: kontrollierter Umsatzstart

- Direktzahlung: nur aktive Logistikregion + fertige Kundenflyer.
- Deutschlandweit: Anfrage mit Gebiet, Menge und Zeitraum jederzeit annehmen.
- Druckservice: Angebot/Pruefung, bis echte Druckpreise und Spezifikationen hinterlegt sind.
- Nachweise: Admin laedt hoch, prueft, veroeffentlicht; Kunde erhaelt danach In-App plus E-Mail.

### Bewusst nach hinten verschieben

- weitere Dashboard-Politur,
- eigene Verteiler-App und Live-GPS,
- automatische Coverage-/Haushaltsgenauigkeit,
- komplexe CRM-/Analytics-Erweiterungen,
- weitere Designvarianten.

## Verifikation dieses Audits

Gruen:

- `npm run test:public-order-planner`
- `npm run test:order-planner-handoff`
- `npm run test:order-planner-pricing`
- `npm run test:order-repeat`
- `npm run test:customer-order-area`
- `npm run test:customer-order-checkout`
- `npm run test:customer-distribution-flow`
- `npm run test:multi-area-order`
- `npm run test:order-fulfillment-branching`
- `npm run test:production-preflight`
- `npm run test:private-storage`
- `npm run test:upload-security`
- `npm run test:public-artifact-privacy`
- `npm run test:external-distribution-report`
- `npm run test:distribution-reports`
- `npm run test:module27-1-runtime`
- `npm run test:module27`
- `npm run test:module27-1-playwright` (Karte wurde im lokalen Lauf als Fallback beobachtet; echtes Google-Live-Mapping ist damit nicht bewiesen.)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Live-Smoke: `https://flyero.org/api/health` antwortete mit `200` und `{"status":"OK"}`.

Nicht als bestanden werten:

- `npm run test:maps-abuse`: Der isolierte Testserver konnte lokal auf Port 3044 nicht starten. Der Rate-Limit-Code ist statisch vorhanden, der Test muss mit einem bereinigten Testserverlauf wiederholt werden.
- echte Live-Stripe-Zahlung,
- echte E-Mail-Zustellung,
- echter Google-Key-/Quota-/Boundary-Test auf Hetzner,
- echter Backup-Restore.

## Entscheidung

**Kontrollierte Beta mit Anfragen:** ja.  
**Offener Direktzahlungs-Launch fuer jedes deutsche Gebiet:** noch nein.  
**Gezielter Umsatzstart:** ja, sobald die vier Gate-1-Punkte geschlossen und die vier Gate-0-Produktionsbeweise dokumentiert sind.
