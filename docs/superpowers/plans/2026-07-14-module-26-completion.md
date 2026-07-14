# FLYERO Modul 26 Abschlussplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden öffentlichen Planner gegen die Modul-26-Akzeptanzkriterien härten, ohne eine zweite Buchungs-, Karten- oder Preislogik zu bauen.

**Architecture:** Der authentifizierte Smart-Maps-Wizard bleibt die gemeinsame UI- und Berechnungsbasis. Die öffentliche Fassade ruft weiterhin `getPlaceAutocomplete`, `geocodeSmartAddress`, `getOrderIntelligence` und `calculateOrderPrice` auf, erhält aber einen strikt öffentlichen Modus ohne lokale Demo-Orte, Tenant-Daten oder operative Informationen. Nicht verfügbare Kartendaten werden als leerer, ehrlicher Zustand dargestellt.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, Zod, Google Maps JavaScript API, bestehende FLYERO-Services und Smoke-Tests.

## Global Constraints

- Keine parallelen `NewOrder`, `NewQuote`, `NewArea`, `NewCheckout` oder `NewAnalytics`-Systeme.
- Keine Datenbankmigration, solange die vorhandenen Modelle und Events ausreichen.
- Öffentliche Quote bleibt unverbindlich; Auftrag und Checkout bleiben authentifiziert.
- Keine Koblenz-Fallbackdaten, Fake-Heatmaps, Fake-Verknappung oder unverdiente Statusaussagen im öffentlichen Planner.
- Server bleibt autoritative Quelle für Preis, Gebietsdaten und Authentifizierung.

---

### Task 1: Öffentliche Maps-Fassade datenrein machen

**Files:**
- Modify: `src/lib/smartMaps.ts`
- Modify: `src/app/api/public/planner/autocomplete/route.ts`
- Modify: `src/app/api/public/planner/geocode/route.ts`
- Test: `tests/public-order-planner-smoke.mjs`

**Interfaces:**
- `getPlaceAutocomplete(query, options?: { publicOnly?: boolean })` liefert im öffentlichen Modus ausschließlich echte Google-Treffer oder `[]`.
- `geocodeSmartAddress(input, options?: { publicOnly?: boolean })` liefert im öffentlichen Modus `null`, wenn Google nicht antwortet; der authentifizierte interne Fallback bleibt kompatibel.

- [ ] **Step 1: Öffentlichen Modus in den bestehenden Service-Signaturen ergänzen.**
- [ ] **Step 2: Lokale Demo-Orte und den Koblenz-Koordinatenfallback im öffentlichen Modus ausschließen.**
- [ ] **Step 3: Public-Routen mit `publicOnly: true` aufrufen und bei leerem Ergebnis einen verständlichen 404/422-Zustand liefern.**
- [ ] **Step 4: Contract-Test gegen lokale `local-*`-Treffer und feste Koblenz-Koordinaten ergänzen.**
- [ ] **Step 5: `npm run test:public-order-planner` ausführen.**

### Task 2: Attrappen aus dem gemeinsamen Wizard entfernen

**Files:**
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify: `src/app/styles/order.css`
- Test: `tests/public-order-planner-smoke.mjs`

**Interfaces:**
- `MiniMapFallback` zeigt nur einen neutralen Zustand mit „Live-Karte nicht verfügbar“ und keine erfundene Geometrie.
- Heatmap bleibt unsichtbar, solange keine echte Kundenfunktion dafür existiert.

- [ ] **Step 1: Fake-SVG, Stadtteilnamen, zufällige Linie und Marker aus dem Fallback entfernen.**
- [ ] **Step 2: Heatmap-State, Heatmap-Button und wirkungslose Notice-Logik entfernen.**
- [ ] **Step 3: Satellit nur als echten Google-Map-Typ beibehalten und Fallback klar als Fallback kennzeichnen.**
- [ ] **Step 4: Test sicherstellen, dass kein sichtbarer Heatmap-Button oder Fake-Polygoncode im Kundenwizard verbleibt.**
- [ ] **Step 5: `npm run lint` und den Planner-Smoke ausführen.**

### Task 3: Öffentliche Quote- und Analytics-Verträge schärfen

**Files:**
- Modify: `src/app/api/public/planner/autocomplete/route.ts`
- Modify: `src/app/api/public/planner/geocode/route.ts`
- Modify: `src/app/api/public/planner/experience/route.ts`
- Modify: `src/app/api/public/planner/quote/route.ts`
- Test: `tests/order-planner-pricing-transparency-smoke.mjs`

**Interfaces:**
- Öffentliche Eingaben werden vor Service-Aufrufen mit Zod begrenzt.
- Quote liefert Netto, MwSt., Brutto, Währung, `pricingVersion`, `calculatedAt`, Confidence und `lineItems` ohne interne Ressourcen.

- [ ] **Step 1: Query- und Event-Schemas mit Längen-, Zahlen- und Allowlist-Grenzen ergänzen.**
- [ ] **Step 2: Public-Quote-Line-Items auf die tatsächlich berechnete Verteilung und klar als Prüfung markierte Druckleistung begrenzen.**
- [ ] **Step 3: Analytics weiter auf Stadt/PLZ-Präfix und notwendige Planungsmetadaten beschränken.**
- [ ] **Step 4: Quote-Contract-Test für Preistransparenz und Datenabgrenzung ausführen.**

### Task 4: Regression, Browser und Produktionsübergabe

**Files:**
- Modify: `README.md` oder `MODULE_26_PUBLIC_PLANNER.md` nur falls die aktuelle Doku den öffentlichen Modus falsch beschreibt.
- Test: `tests/public-order-planner-smoke.mjs`
- Test: `tests/order-planner-handoff-smoke.mjs`
- Test: `tests/order-repeat-smoke.mjs`
- Test: `tests/order-planner-pricing-transparency-smoke.mjs`

- [ ] **Step 1: Prisma Generate, Lint, TypeScript, Modul-16/24 und alle Modul-26-Smokes ausführen.**
- [ ] **Step 2: Customer-Area, Checkout, Portal-UX, Permissions, Tenant-Foundation und Tenant-Policy ausführen.**
- [ ] **Step 3: Public Planner und Auth-Handoff im Desktop- und Mobile-Browser prüfen, inklusive leerer Maps-Antwort und ohne horizontale Überläufe.**
- [ ] **Step 4: Build ausführen und den Ergebnis-Commit auf Feature-Branch und `main` pushen.**
- [ ] **Step 5: Abschlussbericht mit Bestandsmatrix, geschlossenen Lücken, Tests und verbleibenden Risiken erstellen.**
