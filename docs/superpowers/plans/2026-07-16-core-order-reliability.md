# FLYERO Core Order Reliability Implementation Plan

> **For agentic workers:** Use the existing repository patterns. Execute one task at a time and verify before moving to the next task.

**Goal:** Preisfreigabe, Checkout-Sicherheit, deutschlandweite Gebietsplanung und Admin-Auftragsarbeit als belastbare Erweiterung des bestehenden FLYERO-Kernprozesses umsetzen.

**Architecture:** Server-seitige Pricing-, Quote-, Order- und Payment-Services bleiben die einzige Quelle fuer Geschaeftswerte. Der Client zeigt Vorschauen und loest fachliche Aktionen aus. Bestehende Daten und Snapshots werden nicht migriert oder ueberschrieben, sondern durch additive Versionierung und klare Statuspruefungen erweitert.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL, Stripe Checkout, Google Maps APIs, bestehende Smoke-Test-Skripte.

## Global Constraints

- Keine DB-Port-Aenderung; PostgreSQL bleibt auf `127.0.0.1:5432`.
- Keine Migrationen loeschen oder zuruecksetzen.
- Keine zweite Preisformel im Frontend.
- Keine Dummy-, Demo- oder Fake-Gebietsdaten im Kundenflow.
- Bestehende Orders und Pricing-Snapshots duerfen nicht rueckwirkend veraendert werden.
- Keine neue Grunddesign-Revolution; bestehendes Portal- und Order-Design weiterverwenden.

---

### Task 1: Pricing governance and simulation

**Files:**
- Modify: `src/app/admin/settings/pricing/page.tsx`
- Modify: `src/app/api/admin/settings/pricing/route.ts`
- Modify: `src/lib/pricing.ts`
- Modify: `src/lib/servicePricing.ts`
- Create: `src/app/api/admin/settings/pricing/simulate/route.ts`
- Test: `tests/service-pricing-admin-simulation-smoke.mjs`

**Interfaces:**
- The simulation route consumes `serviceType`, `quantity`, `weightInGrams`, `areaDifficulty` and surcharge inputs.
- It produces the same calculation snapshot shape used by the order quote, including rule IDs, version and checkout eligibility.

- [ ] Add a server simulation endpoint that calculates without persisting an order.
- [ ] Reject unknown service types, invalid quantities, invalid weights and invalid rule ranges with a structured 400 response.
- [ ] Add a boundary assertion that checks the first quantity of every tier against the previous tier and refuses a rule set that lowers the price.
- [ ] Show a compact admin preview for representative quantities, net/VAT/gross, factors and manual-review status.
- [ ] Add a smoke test for flyer, catalog and sampling boundary values and a rejected decreasing rule.
- [ ] Run `npm run test:service-pricing-admin-simulation`, `npm run lint`, `npx tsc --noEmit` and `npm run build`.

### Task 2: Checkout idempotency and payment consistency

**Files:**
- Inspect and modify: `src/app/api/payments/checkout/route.ts`
- Inspect and modify: `src/lib/payments.ts`
- Inspect and modify: `prisma/schema.prisma`
- Create if required: `prisma/migrations/<timestamp>_checkout_idempotency/migration.sql`
- Test: `tests/customer-order-checkout-idempotency-smoke.mjs`

**Interfaces:**
- Checkout consumes an authenticated order ID and optional client idempotency key.
- It returns the existing open checkout session when the same order and amount are still valid.

- [ ] Trace all existing payment/session writes and identify the current unique constraints before changing schema.
- [ ] Recalculate the order price and fingerprint on every checkout request.
- [ ] Reuse an existing open payment/session for the same order instead of creating a duplicate.
- [ ] Invalidate stale open sessions when the price fingerprint changed.
- [ ] Ensure paid, cancelled and refunded orders cannot create another checkout session.
- [ ] Test repeated requests, stale fingerprints, changed admin prices and paid-order rejection.
- [ ] Run `npm run test:customer-order-checkout`, the new idempotency test, `npm run lint`, `npx tsc --noEmit` and `npm run build`.

### Task 3: Germany-wide area selection integrity

**Files:**
- Inspect and modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Inspect and modify: `src/lib/planningQuote.ts`
- Inspect and modify: `src/app/api/maps/geocode/route.ts`
- Inspect and modify: `src/app/api/maps/autocomplete/route.ts`
- Inspect and modify: `src/app/api/maps/order-intelligence/route.ts`
- Inspect and modify: `src/app/api/public/planner/quote/route.ts`
- Test: `tests/germany-wide-area-selection-smoke.mjs`

**Interfaces:**
- A selected location carries `query`, `placeId`, `postalCode`, `city`, `lat`, `lng` and `source`.
- A free query carries only normalized `query` until server geocoding resolves it.

- [ ] Verify the selected-place payload and server validation for German locations without city-specific branches.
- [ ] Clear selected location, coordinates, postal code, city, polygon and quote when the visible input changes.
- [ ] Ensure a quote fingerprint contains the normalized location and polygon reference.
- [ ] Add boundary selection only when the Google vector map ID and requested boundary layer are available; otherwise keep drawing/search usable and explain the fallback.
- [ ] Add tests for a PLZ outside the existing demo cities, input mutation, stale polygon rejection and multiple areas.
- [ ] Run `npm run test:customer-order-area`, `npm run test:public-order-planner`, the new Germany-wide test, `npm run lint`, `npx tsc --noEmit` and `npm run build`.

### Task 4: Admin order workspace

**Files:**
- Inspect and modify: `src/app/admin/orders/page.tsx`
- Inspect and modify: `src/app/admin/orders/[id]/page.tsx`
- Inspect and modify: `src/app/api/admin/orders/route.ts`
- Inspect and modify: `src/app/api/admin/orders/[id]/route.ts`
- Test: `tests/admin-order-workspace-smoke.mjs`

**Interfaces:**
- Admin order data keeps existing permissions and tenant filters.
- The UI displays existing order, payment, warehouse, document and report states without inventing missing evidence.

- [ ] Define the next-action mapping from existing order/payment/document/fulfillment/report statuses.
- [ ] Add a dense but readable summary with amount, service, area quality, payment, print data, warehouse, evidence and next action.
- [ ] Link existing actions rather than introducing parallel workflows.
- [ ] Keep customer and distributor private data out of the summary unless the existing permission allows it.
- [ ] Test admin visibility, missing-data states and paid-order protection.
- [ ] Run `npm run test:permissions`, the new workspace test, `npm run lint`, `npx tsc --noEmit` and `npm run build`.

### Task 5: Full verification and publication

**Files:**
- Modify: `SERVICE_PRICING.md`
- Modify: `README.md` only if setup or deployment commands changed

- [ ] Run the complete relevant regression set: service pricing, catalog, customer area, checkout, module 24, module 27, module 27.1 runtime, public planner and landing.
- [ ] Run `npx prisma validate`, `npm run prisma:generate`, `npx prisma migrate status`, `npm run lint`, `npx tsc --noEmit` and `npm run build`.
- [ ] Inspect `git diff --check` and `git status --short`.
- [ ] Commit each logically complete phase separately.
- [ ] Push the verified branch and `HEAD:main` without force push.
- [ ] Record commit hashes, migration status, test results and remaining operational risks.
