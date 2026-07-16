# FLYERO Public Funnel Integrity Audit

Stand: 2026-07-16

## Ziel und Umfang

Geprueft wurden die oeffentlichen Einstiege, die Standortauswahl bis zur Quote und die angrenzenden Sicherheits-, SEO-, Analytics- und Testpfade:

- `/`
- `/verteilung-planen`
- `/verteilung-planen?query=...`
- `/verteilung-anfragen`
- `/preise`
- `/kontakt`
- `/so-funktionierts`
- `/fuer-unternehmen`
- `/fuer-unternehmen#zielgruppen`

Der URL-Fragmentteil `#zielgruppen` wird ausschliesslich im Browser verarbeitet und veraendert keine Server- oder Quotendaten.

## Befundmatrix

| Bereich | Status | Befund und Beleg | Konsequenz |
| --- | --- | --- | --- |
| Oeffentliche Routen und CTAs | bestaetigt | Seiten in `src/app/*/page.tsx`, zentrale Links ueber `MarketingButton` und `LeadForm` | Die oeffentlichen Einstiege sind verbunden; keine neue Parallelstrecke erforderlich. |
| Standortkontext aus Autocomplete | behoben | `PublicPlannerSearch.tsx`, `/api/public/planner/geocode`, `publicLocationContext.ts` | Query, Place-ID, PLZ, Ort, Koordinaten und Quelle werden erst nach serverseitiger Bestaetigung weitergegeben. |
| PLZ-/Ort-Konsistenz | behoben | `/api/public/planner/geocode` vergleicht PLZ und Ort; Zod begrenzt Eingaben | Falsche Kombinationen werden mit einer verstaendlichen Auswahlfehlermeldung abgewiesen. |
| Freie Eingabe ohne Auswahl | behoben | `PublicPlannerSearch.tsx` schreibt nur `query` in die URL | Es werden keine PLZ, Orte oder Koordinaten aus einem blossen Textfeld erfunden. |
| Aenderung nach Auswahl | behoben | `clearLocationSelection()` in `SmartOrderWizard.tsx` | Alte Place-ID, Koordinaten, PLZ, Ort, Polygon, Segmente und Quote werden verworfen. |
| Alter oeffentlicher Besuch | behoben | Oeffentlicher Wizard liest keinen persistenten Draft mehr; alter Public-Draft wird entfernt | Ein neuer Besuch uebernimmt kein altes Gebiet und keine alte Quote. |
| Quote-Zuordnung | bestaetigt | `/api/public/planner/quote`, `getOrderIntelligence`, serverseitige Fingerprints | Die Quote wird serverseitig aus dem aktuellen Gebiet und der aktuellen Eingabe berechnet. |
| Veraltete Antworten | bestaetigt | AbortController und Request-Sequenz im Wizard | Langsame Geocode-/Intelligence-Antworten duerfen keine neuere Auswahl ueberschreiben. |
| Authentifizierter Hand-off | bestaetigt | `trackSubmit()` legt nur beim Wechsel zum Kundenkonto einen aktuellen Auth-Draft ab | Der direkte Buchungsweg kann Login/Registrierung fortsetzen, ohne oeffentliche Standortdaten dauerhaft zu speichern. |
| Mehrgebiete | bestaetigt | `areaSegments`, serverseitige Intelligence und bestehende Modul-27.1-Tests | Teilgebiete werden getrennt verarbeitet und nicht still zu einem fremden Gebiet vermischt. |
| Preisquelle | bestaetigt | zentrale Pricing-Engine ueber `getOrderIntelligence`; Public Quote entfernt operative Daten | Es gibt keine zweite Preisformel im Frontend. |
| Haushaltsdaten | teilweise bestaetigt | Quote liefert Source, Methode, Jahr und Confidence; die tatsaechliche Qualitaet haengt von Gebietsdaten ab | Ohne offizielle oder lizenzierte Quelle darf die UI nur schaetzen bzw. bestaetigte Daten in Aussicht stellen. |
| Google Maps | teilweise bestaetigt | Browser- und Serverpfade sind getrennt; Public API nutzt `publicOnly` | Produktions-Key, Domainrestriktionen und aktivierte Google-Dienste muessen in der Live-Umgebung separat geprueft werden. |
| Anfrage und Idempotenz | bestaetigt | `LeadForm`, `/api/leads`, Lead-Quelle, Idempotenz und Notification-Queue | Doppelte Anfragen werden abgefangen; E-Mail-Zustellung bleibt vom Provider-/Mailbox-Status abhaengig. |
| Analytics | bestaetigt | `/api/public/planner/experience`, begrenzte Eventtypen und Rate Limit | Es werden keine freien Adressdaten als Analytics-Freifeld benoetigt. |
| SEO und Canonical | bestaetigt | `src/app/seo.ts`, `sitemap.ts`, `robots.ts` | Canonical, Sitemap, Robots und JSON-LD verwenden `flyero.org`; Query-Parameter erzeugen keine eigene Sitemap-URL. |
| Mobile und Accessibility | bestaetigt | `visual:marketing`, Playwright-Runtime, sichtbare Status-/Alert-Zustaende und disabled Submit waehrend Aufloesung | Gepruefte Public-Seiten zeigen keinen horizontalen Ueberlauf; Auswahlfehler sind fuer Screenreader als Status/Alert markiert. |
| DB-/Portaenderung | nicht Teil der Aufgabe | Keine Prisma-Datei oder Migration geaendert | PostgreSQL und bestehende Datenmodelle bleiben unveraendert. |

## Verbindlicher Standort-Datenfluss

```text
Autocomplete
  -> Auswahl-ID
  -> /api/public/planner/geocode
  -> serverseitige Google-Antwort
  -> PLZ-/Ort-Abgleich
  -> normalisierter URL-Kontext
  -> SmartOrderWizard
  -> aktuelle Polygon-/Segmentdaten
  -> /api/public/planner/quote
  -> serverseitige Intelligence und Pricing-Engine
```

Ein akzeptierter Autocomplete-Kontext enthaelt:

```text
query, placeId, postalCode, city, lat, lng, source
```

Die Werte werden in `publicLocationContext.ts` begrenzt und normalisiert. `placeId` wird nur fuer Google-Quellen behalten; eine PLZ wird nur als gueltige deutsche fuenfstellige PLZ akzeptiert. Ein freier Text ohne Auswahl wird nicht als bestaetigter Ort behandelt.

## Korrigierte Ursachen

1. **Persistenter Public-Draft:** Ein vorheriger Besuch konnte Standort-/Polygonzustand wieder einlesen. Der Public-Wizard verwirft diesen Zustand jetzt und speichert dort keinen verbindlichen Draft mehr.
2. **Unvollstaendige Autocomplete-URL:** Der sichtbare Vorschlag wurde nicht mit einem vollstaendigen, bestaetigten Kontext weitergegeben. Die Auswahl loest jetzt ein serverseitiges Geocoding aus und schreibt alle Kontextfelder in die URL.
3. **Auswahltext geaendert:** Vorherige Place-ID, Koordinaten und Gebietsdaten konnten bis zur naechsten Berechnung bestehen bleiben. `clearLocationSelection()` leert sie sofort und invalidiert laufende Anfragen.
4. **Freie PLZ-Eingabe:** Eine reine fuenfstellige Eingabe wurde als Ort interpretiert. Ohne Auswahl wird jetzt nur die Query weitergegeben.
5. **Ort-Abgleich:** Neben der PLZ wird der bestaetigte Ort normalisiert verglichen. Schreibvarianten wie Akzente und `ß` werden dabei beruecksichtigt.

## Gepruefte technische Oberflaechen

- UI: `src/app/page.tsx`, `src/app/verteilung-planen/page.tsx`, `src/app/verteilung-anfragen/page.tsx`, `src/app/preise/page.tsx`, `src/app/kontakt/page.tsx`, `src/app/so-funktionierts/page.tsx`, `src/app/fuer-unternehmen/page.tsx`
- Planner: `src/app/PublicPlannerSearch.tsx`, `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Standort/Quote: `src/lib/publicLocationContext.ts`, `src/lib/smartMaps.ts`, `src/app/api/public/planner/autocomplete/route.ts`, `src/app/api/public/planner/geocode/route.ts`, `src/app/api/public/planner/quote/route.ts`
- Analytics: `src/app/api/public/planner/experience/route.ts`, `src/lib/analytics.ts`
- SEO: `src/app/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/layout.tsx`
- Styling: `src/app/globals.css`, `src/app/styles/base.css`, `src/app/styles/marketing.css`, `src/app/styles/portal.css`, `src/app/styles/order.css`
- Anfrage/Benachrichtigungen: `src/app/LeadForm.tsx`, `src/app/api/leads/route.ts`, `src/lib/leads.ts`, `src/lib/notifications.ts`
- CI: `.github/workflows/ci.yml`

## Tests und Verifikation

In dieser Arbeitsrunde erfolgreich:

- `npm run test:public-location-context`
- `npm run test:public-order-planner`
- `npm run test:public-location-navigation-runtime`
- `npm run test:seo-sitemap`
- `npm run test:module16-landing`
- `npm run test:module28-public-playwright`
- `npm run visual:marketing`
- `npm run test:order-planner-handoff`
- `npm run test:customer-order-planner-state`
- `npm run test:order-repeat`
- `npm run test:order-quote-consistency`
- `npm run test:order-stale-quote-block`
- `npm run test:order-area-snapshot`
- `npm run test:planner-funnel-events`
- `npm run test:public-url`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

`npm run visual:marketing` pruefte Home und Anfrage-Strecke auf Desktop, Tablet und Mobil ohne horizontalen Ueberlauf. `npm run test:module28-public-playwright` pruefte die oeffentlichen Navigationen und den Standortfluss mit Browserinteraktion.

## Verbleibende Produktionsrisiken

- Die echte Google-Maps-Konfiguration, erlaubte Domain, Map-ID, aktivierte Boundary-/Geocoding-Dienste und Kostenlimits muessen auf `flyero.org` mit dem Produktionsschluessel geprueft werden.
- Haushaltswerte bleiben nur dann exakt, wenn eine offizielle oder lizenzierte Gebietsdatenquelle hinterlegt ist. Sonst muss die Kundenansicht die Schaetzung und ihre Datenbasis nennen.
- Ein lokaler Build beweist keine externe Provider-Zustellung. Resend `SENT` bedeutet Provider-Annahme; die tatsaechliche Mailbox-Zustellung muss im Resend-Dashboard bzw. ueber Provider-Webhooks nachvollzogen werden.
- Ein echter Produktionsdurchlauf mit einer Test-PLZ, einer Testanfrage und einer Testquote bleibt als Betriebsnachweis erforderlich.

## Nicht umgesetzt

- Keine neue Datenbankmigration.
- Keine neue Preis- oder Statuslogik.
- Kein neues Grunddesign.
- Keine Fake-Karten, Fake-GPS-Daten oder Fake-Haushalte.
- Keine automatische Zusicherung einer exakten Haushaltsabdeckung ohne entsprechende Datenquelle.
