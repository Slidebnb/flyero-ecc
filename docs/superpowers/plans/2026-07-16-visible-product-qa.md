# FLYERO Visible Product QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die sichtbaren Public- und Kundenablaeufe gegen die verbindlichen FLYERO-Regeln pruefen und nur belegte Regressionen testgetrieben beheben.

**Architecture:** Bestehende Next.js-Seiten, serverseitige APIs und zentrale Services bleiben unveraendert, solange kein konkreter Root Cause gefunden ist. Tests pruefen zuerst die sichtbare Vertragsflaeche; Browser-Screenshots bestaetigen danach das echte Rendering auf Desktop und Mobile.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, bestehende Node-Smoke-Tests, Codex In-app Browser.

## Global Constraints

- Keine DB-Port-Aenderungen und keine Migrationen loeschen oder zuruecksetzen.
- Keine neuen Businessmodule und kein neues Grunddesign.
- Keine sichtbaren Demo-, Mock-, Seed- oder technischen Kundentexte.
- Keine Fake-GPS-Daten, Fake-Fotos, Fake-Heatmaps oder erfundene Haushaltsdaten.
- Preise, Gebietsdaten, Status und Berechtigungen bleiben serverseitig verbindlich.
- Screenshot-Timeouts oder fehlende Screenshots werden als offen gemeldet.

---

### Task 1: QA-Ausgangslage erfassen

**Files:**
- Read: `AGENTS.md`
- Read: `docs/FLYERO_PROJECT_MEMORY.md`
- Read: `docs/FLYERO_NO_REGRESSION_RULES.md`
- Read: `docs/FLYERO_VISUAL_QA_CHECKLIST.md`
- Read: `src/app/page.tsx`
- Read: `src/app/PublicPlannerSearch.tsx`
- Read: `src/app/customer/orders/new/SmartOrderWizard.tsx`

- [ ] **Step 1: Arbeitsstand pruefen**

```powershell
git status --short --branch
git log -5 --oneline
```

Expected: Branch und uncommitted changes sind dokumentiert, ohne fremde Aenderungen zu ueberschreiben.

- [ ] **Step 2: Sichtbare verbotene Begriffe suchen**

```powershell
rg -n "Beispielhafter Ablauf|keine echte Kampagne|Mock|Demo|Seed|Fallback|Quote|Fingerprint|RPT-SEED|pi_seed|Wartet intern" src/app --glob '!**/api/**'
```

Expected: Jeder Treffer wird als sichtbar, intern, Test oder false positive eingeordnet; sichtbare Public-/Customer-Treffer werden als Testfall erfasst.

### Task 2: Regressionstest fuer den belegten Fehler schreiben

**Files:**
- Create or modify: `tests/visible-product-qa-smoke.mjs`
- Modify: `package.json`

**Interface:** Der Test laedt die betroffenen Server-Seiten, prueft die verbotenen sichtbaren Begriffe und verifiziert die CTA-/Preisstatus-Vertraege.

- [ ] **Step 1: Failing test schreiben**

Der Test muss mindestens diese Assertions enthalten:

```js
assert(!publicHtml.match(/Beispielhafter Ablauf|keine echte Kampagne|Mock Checkout|Seed|Fallback/i));
assert(customerHtml.includes("Neue Verteilung"));
assert(!customerHtml.match(/RPT-SEED|pi_seed|Wartet intern|Fingerprint/i));
assert(homeHtml.includes("Gebiet ansehen"));
```

- [ ] **Step 2: Test isoliert ausfuehren und erwarteten Fehlschlag bestaetigen**

```powershell
npm run test:visible-product-qa
```

Expected: FAIL nur wegen des reproduzierten sichtbaren Fehlers; Netzwerk- oder Server-Timeouts werden separat behoben und nicht als Assertionserfolg gewertet.

### Task 3: Root Cause minimal beheben

**Files:**
- Modify: exakt die Datei, in der der Regressionstest den sichtbaren Fehler nachweist.
- Do not modify: Prisma-Schema, Migrationen, Produktionsports oder unbeteiligte Portalbereiche.

- [ ] **Step 1: Datenfluss und Arbeitsbeispiel vergleichen**

Den fehlerhaften Wert von Rendering ueber Component/Service bis zur Quelle verfolgen und mit einer funktionierenden, gleichartigen Seite vergleichen.

- [ ] **Step 2: Kleinsten Root-Cause-Fix implementieren**

Nur die Ursache beheben. Keine parallele zweite Komponente, keine allgemeine Umbenennung und keine neuen Businessregeln einfuehren.

- [ ] **Step 3: Regressionstest erneut ausfuehren**

```powershell
npm run test:visible-product-qa
```

Expected: PASS mit echter Assertion-Ausgabe.

### Task 4: Fachliche und technische Regressionen pruefen

**Files:**
- Read and test: `prisma/schema.prisma`, betroffene API-Routen, betroffene Services und bestehende Tests.

- [ ] **Step 1: Prisma- und Build-Pruefungen ausfuehren**

```powershell
npx prisma validate
npm run prisma:generate
npm run lint
npm run build
```

- [ ] **Step 2: Relevante Fachtests ausfuehren**

```powershell
npm run test:module16-landing
npm run test:module24
npm run test:module27
npm run test:module27-1-runtime
npm run test:module28
npm run test:public-order-planner
npm run test:customer-order-area
npm run test:customer-order-checkout
npm run test:customer-portal-ux
```

Expected: Jeder Test wird mit Exit-Code und relevanter Ausgabe dokumentiert. Ein Timeout bleibt offen.

### Task 5: Browser-QA und Abschluss

**Files:**
- Create: QA-Screenshots ausserhalb des Repositories oder im vereinbarten Artefaktpfad.
- Update: betroffene Dokumentation, falls die reale Abweichung eine Regel oder bekannte Einschränkung betrifft.

- [ ] **Step 1: Public-Seiten bei 1440px und 390px erfassen**
- [ ] **Step 2: Kunden-Seiten mit lokalem Demo-Konto bei 1440px und 390px erfassen**
- [ ] **Step 3: Suche, CTA, Menu und betroffenen Wizard-Schritt bedienen**
- [ ] **Step 4: Screenshots und Console-Logs sichtbar pruefen**
- [ ] **Step 5: `git diff --check`, Commit und Push ausfuehren**

Expected: Abschlussbericht nennt Root Cause, Regressionstest, geaenderte Dateien, alle wirklich ausgefuehrten Checks, absolute Screenshotpfade und offene Risiken.
