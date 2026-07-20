# FLYERO Customer Order Core Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/customer/orders/new` reliable from fresh entry through location selection, exact area drawing, current server quote, warehouse choice, inquiry or eligible direct booking, without stale draft or stale calculation values.

**Architecture:** Preserve the existing `SmartOrderWizard` and its focused hooks/components. Keep browser values as input/preview only; `/api/maps/order-intelligence` and `POST /api/customer/orders` remain the server sources of truth. Fix state invalidation centrally at location/segment changes, then verify the same payload through API and browser tests.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 7, PostgreSQL, Google Maps JavaScript API, Playwright, Node smoke tests.

## Global Constraints

- PostgreSQL remains on `127.0.0.1:5432` locally; no migration reset or port change.
- No hardcoded city fallback, default warehouse, fake household count, fake route, fake proof, or client-authoritative price.
- Public planner and customer wizard must remain logically aligned.
- Every production behavior fix receives a failing regression test before implementation.
- UI changes require real desktop and mobile screenshots and honest console/error reporting.
- Preserve unrelated working-tree changes and do not use destructive Git commands.

## Current Investigation Matrix

| Category | Current evidence | Next verification |
|---|---|---|
| Existing and correct | Fresh reset path, abortable autocomplete, server intelligence endpoint, stale quote gate, sampling manual-review gate | Run focused tests and browser flow |
| Present but incomplete | Local preview values, warehouse suggestion/selection coupling, saved-draft restoration, Google boundary/draw transitions | Reproduce location replacement, area change, warehouse reset, repeat/fresh paths |
| Fault-prone | Any path that changes location while a polygon/quote/warehouse exists; quote status while drawing | Add tests first, then patch shared invalidation |
| Missing evidence | Full customer Playwright artifacts for requested states, remote GitHub green run | Execute after fixes |
| Out of scope | Marketing, SEO, dashboard redesign, reports, support, branding | Do not modify |

### Task 1: Baseline and P0 reproduction

**Files:**
- Read: `src/app/customer/orders/new/SmartOrderWizard.tsx`, `hooks/useOrderIntelligence.ts`, `hooks/useOrderLocationSearch.ts`, `src/app/api/maps/order-intelligence/route.ts`, `src/app/api/customer/orders/route.ts`
- Test: existing customer order and planner smoke tests

- [ ] Run the focused baseline commands and record the first failures.
- [ ] Reproduce fresh start, location replacement, polygon update, stale quote, warehouse reset, sampling, inquiry, and direct-payment gates.
- [ ] Record exact state transitions and classify P0/P1/P2 before editing.

### Task 2: Location and area-state invalidation

**Files:**
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify: `src/app/customer/orders/new/hooks/useOrderIntelligence.ts` only if request invalidation cannot be expressed at the wizard boundary
- Test: add or extend `tests/customer-order-new-flow-smoke.mjs` and `tests/customer-order-planner-state-smoke.mjs`

- [ ] Write a failing test proving a new selected postal code removes the old polygon, area metrics, quote, warehouse, and map selection.
- [ ] Write a failing test proving stale location responses cannot restore old values.
- [ ] Implement one shared reset path used by free text, suggestion selection, Enter, search button, and new segment selection.
- [ ] Keep confirmed location identity (`query`, `placeId`, `postalCode`, `city`, `lat`, `lng`, `source`) together.
- [ ] Verify area status transitions: empty, searching, location found/no area, drawing, area ready, price loading, price ready, review/error.

### Task 3: Live summary and server quote integrity

**Files:**
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify only if required: `src/lib/smartMaps.ts`, pricing or logistics service used by the intelligence route
- Test: `tests/customer-planner-live-summary-smoke.mjs`, `tests/order-quote-consistency-smoke.mjs`, `tests/order-stale-quote-block-smoke.mjs`, plus a new focused regression if needed

- [ ] Write a failing test for preview area versus committed area and old response ordering.
- [ ] Ensure preview copy never presents local estimates as confirmed server data.
- [ ] Ensure recommended quantity is at least the configured minimum and is recalculated from the current area only.
- [ ] Ensure price status never stays on a permanent loading label and shows net/VAT/gross only for the matching confirmed request.
- [ ] Keep server-derived difficulty, weight class, pricing rule, fingerprint, and snapshot authoritative at submit.

### Task 4: Material, warehouse, sampling, and completion gates

**Files:**
- Modify only if baseline exposes a defect: `OrderMaterialStep.tsx`, `OrderFinishStep.tsx`, `SmartOrderWizard.tsx`, `src/app/api/customer/orders/route.ts`
- Test: `tests/customer-order-checkout-smoke.mjs`, `tests/customer-order-checkout-idempotency-smoke.mjs`, `tests/customer-own-flyer-warehouse-smoke.mjs`, `tests/service-format-options-smoke.mjs`, `tests/service-pricing-smoke.mjs`, `tests/single-area-logistics-gate-smoke.mjs`

- [ ] Write failing tests for no silent warehouse fallback and no stale warehouse after a region change.
- [ ] Verify own-flyer flow requires an active selected warehouse, while manual review still permits inquiry.
- [ ] Verify sampling stores required details, blocks checkout, and exposes only the inquiry action.
- [ ] Verify double-click and stale fingerprint behavior remain idempotent and server-enforced.

### Task 5: Browser evidence and final verification

**Files:**
- Modify: `tests/customer-order-new-playwright.mjs` and/or add a focused Playwright test under `tests/`
- Artifacts: `.tmp/customer-order-new/desktop/`, `.tmp/customer-order-new/mobile/`

- [ ] Run the requested normal, new-search, manual-review, sampling, stale-quote, and mobile flows.
- [ ] Save `start.png`, `location-selected.png`, `area-drawn.png`, `price-ready.png`, `summary.png`, `sampling.png`, and `manual-review.png` for desktop and mobile where the flow supports them.
- [ ] Inspect screenshots visually and record console errors; a timeout or uninspected screenshot remains open.
- [ ] Run Prisma validation/generation, lint, build, all listed customer-order tests, and the relevant CI smoke tests.
- [ ] Commit only related changes, push to `main`, and verify the new GitHub Actions run is green before claiming completion.

## Verification Command Set

```text
npx prisma validate
npm run prisma:generate
npm run lint
npm run build
npm run test:customer-planner-live-summary
npm run test:customer-planner-integrity
npm run test:customer-order-area
npm run test:customer-order-checkout
npm run test:customer-order-checkout-idempotency
npm run test:customer-order-new-flow
npm run test:customer-order-new-playwright
npm run test:customer-order-planner-state
npm run test:customer-new-order-fresh-start
npm run test:order-planner-handoff
npm run test:order-planner-pricing
npm run test:order-quote-consistency
npm run test:order-stale-quote-block
npm run test:order-area-snapshot
npm run test:order-metrics-consistency
npm run test:customer-own-flyer-warehouse
npm run test:single-area-logistics-gate
npm run test:multi-area-order
npm run test:service-format-options
npm run test:service-catalog
npm run test:service-pricing
npm run test:pricing-no-fallback
npm run test:area-difficulty-derivation
npm run test:server-area-snapshot
npm run test:module27-1-runtime
```
