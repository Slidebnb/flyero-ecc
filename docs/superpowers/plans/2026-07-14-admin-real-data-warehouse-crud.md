# Admin Real Data And Warehouse CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove demo-only warehouse records from production-facing admin views and provide a safe, fully persisted warehouse lifecycle for administrators.

**Architecture:** Keep Prisma as the only source of truth. Mark seed records explicitly as demo data, make production reads exclude them, and guard the seed against accidental production execution. Warehouse deletion is conservative: unused records can be deleted, referenced records are deactivated instead of breaking historical logistics data.

**Tech Stack:** Next.js App Router, TypeScript, Prisma 7, PostgreSQL, existing `AdminPortalShell`, existing permission and audit-log helpers.

## Global Constraints

- No mock or dummy data may appear in production admin or customer workflows.
- Existing production records and report history must not be deleted implicitly.
- No PostgreSQL port changes and no destructive migration reset.
- New warehouse records must be usable in logistics, orders, and reports through the existing Prisma relations.
- All mutations require the existing admin permissions and create audit-log entries.

---

### Task 1: Mark demo records and isolate production seed behavior

**Status:** abgeschlossen

**Files:**
- Modify: `prisma/schema.prisma` (`Warehouse` model)
- Create: `prisma/migrations/20260714120000_warehouse_demo_source/migration.sql`
- Modify: `prisma/seed.mjs`
- Modify: `.env.example`
- Modify: `.env.production.example`
- Test: `tests/admin-warehouse-real-data.mjs`

**Interfaces:**
- `Warehouse.isDemoData: boolean` is `false` for admin-created records and `true` only for explicit demo seed records.
- `SEED_DEMO_DATA=true` is required to execute demo seeding; production startup never creates demo rows implicitly.

- [ ] **Step 1: Write the failing test**

  Add assertions that a newly created warehouse is non-demo and that the seed refuses to create demo data when `NODE_ENV=production` without `SEED_DEMO_DATA=true`.

- [ ] **Step 2: Run the focused test and verify it fails for the missing field/guard**

  Run: `node tests/admin-warehouse-real-data.mjs`

- [ ] **Step 3: Add the additive Prisma field and migration**

  Add `isDemoData Boolean @default(false)` to `Warehouse`. The migration must use `ALTER TABLE "Warehouse" ADD COLUMN "isDemoData" BOOLEAN NOT NULL DEFAULT false;` and must not delete rows.

- [ ] **Step 4: Gate demo seeding explicitly**

  At the top of `prisma/seed.mjs`, exit with a clear message when `NODE_ENV=production` and `SEED_DEMO_DATA` is not exactly `true`. Set `isDemoData: true` on every warehouse created by the seed.

- [ ] **Step 5: Document the opt-in variable**

  Add `SEED_DEMO_DATA="false"` to both environment examples with the explanation that it is test/development-only.

- [ ] **Step 6: Run the focused test and commit**

  Run: `node tests/admin-warehouse-real-data.mjs`

  Commit: `git add prisma .env.example .env.production.example tests/admin-warehouse-real-data.mjs && git commit -m "chore: isolate demo warehouse seed data"`

### Task 2: Make admin warehouse reads production-real-data only

**Status:** abgeschlossen

**Files:**
- Modify: `src/app/api/admin/settings/warehouses/route.ts`
- Modify: `src/app/admin/settings/warehouses/page.tsx`
- Modify: `src/app/api/admin/logistics/warehouses/route.ts`
- Modify: `src/app/api/admin/warehouse/route.ts`
- Test: `tests/admin-warehouse-real-data.mjs`

**Interfaces:**
- Production list queries add `where: { isDemoData: false }`.
- Development/test queries retain seeded records for existing isolated tests.
- Admin UI shows a truthful empty state when no real warehouses exist and never fabricates a fallback warehouse.

- [ ] **Step 1: Add a failing contract assertion**

  Assert in the test source that all production-facing warehouse list queries apply the non-demo filter and that the page contains a real empty state.

- [ ] **Step 2: Run the contract test and verify it fails**

  Run: `node tests/admin-warehouse-real-data.mjs`

- [ ] **Step 3: Implement one shared query predicate**

  Add a small server-only helper in `src/lib/warehouse.ts` returning `{ isDemoData: false }` when `NODE_ENV === "production"`, and `{}` otherwise. Use it in the four list/read paths instead of duplicating environment checks.

- [ ] **Step 4: Replace empty/fallback presentation**

  The settings page must render `Noch kein echtes Lager angelegt.` plus the existing create form when the filtered result is empty. No sample city, capacity, route, or warehouse name may be inserted.

- [ ] **Step 5: Run the contract test, lint, and commit**

  Run: `node tests/admin-warehouse-real-data.mjs` and `npm run lint`

  Commit: `git add src tests && git commit -m "fix: hide demo warehouses from production admin"`

### Task 3: Complete safe warehouse lifecycle actions

**Status:** abgeschlossen

**Files:**
- Modify: `src/app/api/admin/settings/warehouses/[id]/route.ts`
- Modify: `src/app/admin/settings/warehouses/page.tsx`
- Modify: `src/lib/warehouse.ts`
- Test: `tests/admin-warehouse-real-data.mjs`

**Interfaces:**
- `PATCH /api/admin/settings/warehouses/[id]` updates real warehouse metadata and active/default status.
- `DELETE /api/admin/settings/warehouses/[id]` deletes only unreferenced real warehouses; referenced warehouses return a conflict and remain available for deactivation.
- The server action uses the same rules and never deletes demo records implicitly.

- [ ] **Step 1: Add failing lifecycle tests**

  Cover create, update, deactivate, delete of an unreferenced warehouse, and refusal to delete a warehouse referenced by orders, tours, inventory, shipments, transfers, or reports.

- [ ] **Step 2: Run tests and verify the new delete contract fails**

  Run: `node tests/admin-warehouse-real-data.mjs`

- [ ] **Step 3: Implement reference checks**

  In `src/lib/warehouse.ts`, add a typed helper that checks all existing Prisma relations before delete. Return a conflict result with a German user-facing message when references exist.

- [ ] **Step 4: Implement audited DELETE**

  Require `Permission.WAREHOUSE_MANAGE`, reject demo IDs in production, delete only after the reference check, write `settings.warehouse_deleted` to the audit log, and notify admins.

- [ ] **Step 5: Add visible deactivate/delete controls**

  Keep “Lager deaktivieren” as the safe default. Add “Lager löschen” only with a confirmation form/button and explain that referenced historical data requires deactivation.

- [ ] **Step 6: Run focused tests and commit**

  Run: `node tests/admin-warehouse-real-data.mjs` and `npm run lint`

  Commit: `git add src tests && git commit -m "feat: add safe warehouse lifecycle management"`

### Task 4: Verify production behavior and publish

**Status:** in Ausführung

**Files:**
- Modify: `docs/KNOWN_ISSUES.md` or `MVP_DISTRIBUTION_EVIDENCE.md` only if operational notes need updating.

- [ ] **Step 1: Run repository checks**

  Run: `node tests/admin-warehouse-real-data.mjs`, `npm run lint`, `npm run build`, `git diff --check`.

- [ ] **Step 2: Inspect the final diff and verify no DB port or secret changes**

  Run: `git status --short`, `git diff --stat`, and `rg -n "55432|127\\.0\\.0\\.1:5432|DATABASE_URL" src prisma docker-compose.production.yml`.

- [ ] **Step 3: Commit any documentation-only adjustment**

  Use a focused commit message that describes only the remaining documentation change.

- [ ] **Step 4: Push the current branch to GitHub**

  Run: `git push origin HEAD` and report the exact commit and push result.

## Data safety and rollback

- The first migration is additive and defaults all existing warehouses to `isDemoData=false`; the follow-up migration marks only unambiguous `demo-` IDs or notes containing `demo`/`seed`, preserving all other production records.
- Existing seed rows are not silently deleted. They are explicitly marked by the opt-in seed path and can be removed only through a separately reviewed cleanup operation after backup verification.
- A failed delete leaves the warehouse intact and offers deactivation, preserving order/report history.
- Rollback is a code revert plus a forward migration if needed; do not use `prisma migrate reset` against production.

## Scope gaps intentionally excluded

- This plan does not remove every historical demo order, report, payment, or user from an already-seeded database. Those records require a separately audited purge script with a backup and a dry-run report.
- This plan does not add a new warehouse business module; it completes the existing settings/logistics surface.
