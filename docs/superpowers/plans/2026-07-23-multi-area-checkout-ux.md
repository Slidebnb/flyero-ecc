# Multi-Area Checkout UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve committed delivery segments while adding another area, prevent raw validation text during checkout, and make flyer quantity the first clear material decision.

**Architecture:** Keep the existing `SmartOrderWizard` and server-side `orderCreateSchema` as the sources of truth. A location change replaces only the active draft segment and retains other committed polygons; the checkout API continues to recalculate pricing server-side. UI copy and field order change only inside the existing material step.

**Tech Stack:** Next.js 16, React, TypeScript, Zod, Prisma, Node smoke tests, Google Maps boundary overlays.

## Global Constraints

- No migration deletion or PostgreSQL port changes.
- No client value is authoritative for area, price, quantity, or checkout.
- No visible technical validation or internal status terms in customer views.
- Existing committed segments must remain separate and aggregate into one order.
- Direct payment requires a current server-side price fingerprint.
- UI changes require desktop and 390px mobile screenshots; failed screenshot checks remain open.

---

### Task 1: Regression coverage

**Files:**
- Create: `tests/customer-order-multi-segment-checkout-ux-smoke.mjs`
- Test: `src/app/customer/orders/new/SmartOrderWizard.tsx`, `src/lib/validators.ts`

- [ ] **Step 1: Assert the active location change preserves committed segments.**
- [ ] **Step 2: Assert adding a segment updates the ref used by map selection.**
- [ ] **Step 3: Assert customer-facing validation messages replace raw minimum-length errors.**
- [ ] **Step 4: Run the new smoke test and confirm it fails against the current source.**

### Task 2: Preserve multi-area state

**Files:**
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`

- [ ] **Step 1: Keep valid non-active segments when a new location is searched.**
- [ ] **Step 2: Remove only the active empty/replaced segment before the new boundary is committed.**
- [ ] **Step 3: Update `areaSegmentsRef` synchronously when a new segment placeholder is created.**
- [ ] **Step 4: Ensure `applySavedArea` removes an empty active placeholder instead of serializing it.**
- [ ] **Step 5: Run the regression test and confirm both locations remain in the payload.**

### Task 3: Make checkout errors customer-friendly

**Files:**
- Modify: `src/lib/validators.ts`
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`

- [ ] **Step 1: Give city, PLZ, and area-name validators German actionable messages.**
- [ ] **Step 2: Guard direct checkout when no valid planning city or five-digit PLZ exists.**
- [ ] **Step 3: Keep server-side validation and current price-fingerprint checks unchanged.**
- [ ] **Step 4: Run checkout smoke tests.**

### Task 4: Clarify flyer quantity

**Files:**
- Modify: `src/app/customer/orders/new/OrderMaterialStep.tsx`
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`

- [ ] **Step 1: Put “Wie viele Flyer möchtest du verteilen?” before service-format details.**
- [ ] **Step 2: Keep the existing minimum quantity and server validation.**
- [ ] **Step 3: Explain the recommendation and allow direct editing without duplicating business logic.**

### Task 5: Verification and release

**Files:**
- Modify only the files above and the focused test.

- [ ] **Step 1: Run focused smoke tests.**
- [ ] **Step 2: Run lint and production build.**
- [ ] **Step 3: Capture and inspect desktop and 390px mobile screenshots.**
- [ ] **Step 4: Commit only the scoped changes and push `main`.**
- [ ] **Step 5: Deploy, force-recreate the app container, and verify health plus live checkout entry.**
