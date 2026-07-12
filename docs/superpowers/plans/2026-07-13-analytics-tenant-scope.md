# Analytics Tenant Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent non-admin internal users from receiving cross-tenant analytics, support KPIs, document KPIs, or CSV rows.

**Architecture:** Keep platform admins global. Pass the authenticated tenant scope from the route/page into the analytics services and add it to every aggregate query. Existing models already contain tenant relations for orders, payments, documents, reports, inventories, and support tickets; no migration is required.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Node smoke tests.

## Global Constraints

- No database port changes; PostgreSQL remains `127.0.0.1:5432`.
- No schema migration in this package.
- Admin remains platform-global; non-admin support users are tenant-scoped.
- Existing public leads without a tenant remain excluded from tenant-scoped lead analytics rather than being exposed cross-tenant.
- Every change receives focused tests, lint/build verification, and a GitHub push to `main`.

### Task 1: Add scope-aware analytics query helpers

**Files:**
- Modify: `src/lib/analytics.ts`
- Modify: `src/lib/support.ts`
- Modify: `src/lib/documents.ts`
- Test: `tests/analytics-tenant-scope-smoke.mjs`

- [x] **Step 1: Write the failing contract test**

Assert that the analytics service accepts a tenant scope, every public aggregate entry point exposes the scope parameter, and support/document KPI services accept the same scope.

- [x] **Step 2: Run the focused test and confirm it fails**

Run `node tests/analytics-tenant-scope-smoke.mjs`; expected result is a failed contract assertion before the new scope signatures and filters exist.

- [x] **Step 3: Implement the minimal scope**

Add `AnalyticsScope = { tenantId?: string | null }`, merge tenant filters into orders, payments, refunds, customers, distributors through their user relation, tours, inventory, reports, and support/documents. Use `wonCustomer.tenantId` for tenant-scoped lead analytics; leave the global path unchanged for admins.

- [x] **Step 4: Run the focused test and typecheck through the build**

Run `node tests/analytics-tenant-scope-smoke.mjs` and `npm run build`; expected result is PASS and a successful TypeScript build.

### Task 2: Pass authenticated scope through pages and APIs

**Files:**
- Modify: `src/app/api/admin/analytics/route.ts`
- Modify: `src/app/api/admin/analytics/export/route.ts`
- Modify: `src/app/api/admin/analytics/orders/route.ts`
- Modify: `src/app/api/admin/analytics/revenue/route.ts`
- Modify: `src/app/api/admin/analytics/distributors/route.ts`
- Modify: `src/app/admin/analytics/page.tsx`
- Modify: `src/app/admin/support/page.tsx`
- Modify: `src/app/admin/documents/page.tsx`

- [x] **Step 1: Pass `session.tenantId` to service calls**

Use `{ tenantId: session.tenantId }` for every scoped call. Admin sessions pass `null` and retain global platform analytics.

- [x] **Step 2: Verify no unscoped call remains in the affected surfaces**

Run `rg -n "getBusinessOverview\(|getAnalyticsExportRows\(|getOrderMetrics\(|getRevenueMetrics\(|getDistributorMetrics\(|getSupportAnalytics\(|getDocumentAnalytics\(" src/app src/lib` and inspect every result.

### Task 3: Regression gate and publish

**Files:**
- Modify: `TECHNICAL_DUE_DILIGENCE_AUDIT_2026-07-12.md`

- [x] **Step 1: Update the audit evidence**

Record that the analytics/support/document aggregate paths are tenant-scoped for non-admin sessions and that no migration was needed.

- [x] **Step 2: Run all required checks**

Run `node tests/analytics-tenant-scope-smoke.mjs`, `npm run lint`, `npm run build`, `npx prisma migrate status`, and `git diff --check`.

- [x] **Step 3: Commit and push**

Run `git add` for only the plan, implementation, test, and audit files; commit with `Enforce tenant scope in analytics`; push `origin main`; verify `git rev-parse HEAD` equals `git ls-remote origin refs/heads/main`.
