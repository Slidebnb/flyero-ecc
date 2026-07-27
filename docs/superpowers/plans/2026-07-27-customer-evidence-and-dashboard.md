# Customer Evidence And Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make clean admin-uploaded distribution evidence immediately customer-visible, remove the generic customer file manager from the primary journey, and make the latest saved area render reliably on the first dashboard and post-checkout view.

**Architecture:** Keep the existing Document, Report, protected-download, tenant-scope, and notification infrastructure. A dedicated admin evidence upload remains the source of truth; a successful required malware scan becomes the automatic release gate for that evidence. The customer portal exposes only published reports and released evidence, while the legacy document and print APIs remain available for internal compatibility. The dashboard continues to read the immutable order area snapshot server-side and the map component retries its client initialization safely.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL/PostGIS, existing document storage and ClamAV scan service, Node smoke tests, Playwright where available.

## Global Constraints

- Do not delete migrations or change the PostgreSQL port.
- Do not expose unscanned or failed-scan files to customers.
- Do not expose internal document/report states in customer UI.
- Preserve tenant ownership and protected downloads.
- Do not change the frozen checkout and pricing architecture.
- Do not invent GPS, photo, coverage, or area data.

### Task 1: Add failing regression contracts

**Files:**
- Create: `tests/customer-evidence-auto-release-smoke.mjs`
- Create: `tests/customer-dashboard-area-first-load-smoke.mjs`
- Modify: `package.json`

- [ ] **Step 1: Assert clean evidence auto-release, scan gate, and notification behavior.**
- [ ] **Step 2: Assert customer navigation has no primary generic file manager and evidence remains protected.**
- [ ] **Step 3: Assert dashboard uses the current order area snapshot and map initialization has retry-safe loading.**
- [ ] **Step 4: Run both tests and confirm they fail against the current behavior.**

### Task 2: Automatically release clean admin evidence

**Files:**
- Modify: `src/lib/externalEvidence.ts`
- Modify: `src/lib/notifications.ts` only if an existing idempotent notification helper is required
- Test: `tests/customer-evidence-auto-release-smoke.mjs`

- [ ] **Step 1: Keep file type, size, signature, tenant, and required scan validation unchanged.**
- [ ] **Step 2: For a clean admin evidence upload, write `APPROVED`, `customerVisible`, `reviewStatus`, approver, and approval timestamp in the same persistence flow.**
- [ ] **Step 3: Keep failed or unavailable scans non-visible and preserve the existing error path.**
- [ ] **Step 4: Record an audit event and enqueue the customer-facing availability notification exactly once for the evidence release.**
- [ ] **Step 5: Re-run the focused regression test.**

### Task 3: Simplify customer evidence navigation

**Files:**
- Modify: `src/app/customer/CustomerPortalShell.tsx`
- Modify: `src/app/customer/orders/new/SmartOrderWizard.tsx`
- Modify: `src/app/customer/orders/[id]/page.tsx`
- Modify: `src/app/customer/documents/page.tsx`
- Modify: `src/app/customer/orders/[id]/documents/page.tsx`
- Modify: `src/app/customer/customerUx.ts`
- Modify: affected customer smoke tests

- [ ] **Step 1: Remove generic “Dateien” from the primary customer navigation and wizard navigation.**
- [ ] **Step 2: Replace customer-facing file-manager entry points with “Nachweise” or campaign detail links.**
- [ ] **Step 3: Keep legacy document endpoints and internal/admin document operations intact.**
- [ ] **Step 4: Ensure customer reports list only released/published evidence without technical statuses.**
- [ ] **Step 5: Run customer portal and document privacy tests.**

### Task 4: Stabilize first-load and post-checkout area rendering

**Files:**
- Modify: `src/app/components/DistributionAreaPreviewMap.tsx`
- Modify: `src/app/customer/dashboard/page.tsx` only where necessary
- Modify: checkout success/redirect consumer only if the existing route is proven stale
- Test: `tests/customer-dashboard-area-first-load-smoke.mjs`

- [ ] **Step 1: Preserve the server-loaded order snapshot as the only area source.**
- [ ] **Step 2: Make the map loader handle an already-present Google script, late `google.maps`, and import-library failures without leaving a permanent first-load error.**
- [ ] **Step 3: Ensure post-checkout navigation refreshes the current server tree after the order is persisted.**
- [ ] **Step 4: Keep the honest empty state only for a genuinely missing area snapshot.**
- [ ] **Step 5: Run dashboard and checkout regression checks.**

### Task 5: Full verification and release

- [ ] **Step 1: Run focused smoke tests.**
- [ ] **Step 2: Run lint, Prisma validation/generation, TypeScript build, and relevant customer/report/privacy tests.**
- [ ] **Step 3: Generate and inspect 1440px and 390px customer screenshots.**
- [ ] **Step 4: Commit only scoped changes.**
- [ ] **Step 5: Push `main`, deploy, and verify remote SHA, migration state, container health, API health, logs, and live browser smoke flow.**
