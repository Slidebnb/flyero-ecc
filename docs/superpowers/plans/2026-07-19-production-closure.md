# FLYERO Customer Order Flow Stabilization Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `/customer/orders/new` understandable and reliable from German postal-code search through area selection, price preview, inquiry, and permitted checkout without introducing a new visual foundation.

**Architecture:** The server remains the source of truth for area intelligence, difficulty, pricing, order snapshots, permissions, and customer-visible notifications. Client values are preview hints only. Production validation and readiness must be exercised against the production build, while public/customer UI stays within the existing FLYERO design system.

**Tech Stack:** Next.js 16, TypeScript, Prisma/PostgreSQL, Node smoke tests, Playwright, Docker Compose, GitHub Actions.

## Global Constraints

- Read `AGENTS.md`, `docs/FLYERO_PROJECT_MEMORY.md`, `docs/FLYERO_NO_REGRESSION_RULES.md`, `docs/FLYERO_VISUAL_QA_CHECKLIST.md`, `DEPLOYMENT_HETZNER.md`, and `BACKUP_RESTORE_RUNBOOK.md` before edits.
- No database port changes, no migration deletion, no destructive Git operations, and no new visual foundation.
- No fake GPS, fake proof, demo data, or client-controlled business values in customer-facing flows.
- Every bug fix gets a regression test first; final claims require fresh command and screenshot evidence.

## Task 1: Reproduce and lock the P0 data boundaries

- [ ] Trace the customer order route, planning quote, map intelligence, pricing snapshot, and order integrity paths.
- [ ] Add a regression test that submits manipulated area snapshot fields and proves they are not persisted.
- [ ] Add a regression test for server-derived difficulty overriding client hints and feeding pricing/fingerprint consistently.
- [ ] Add a regression test for multi-segment and non-Koblenz postal-code inputs using the shared server calculation path.

## Task 2: Implement authoritative area snapshots and difficulty

- [ ] Add a small server-only sanitizer/derivation module using the existing geometry and intelligence services.
- [ ] Persist only server-generated household, coverage, confidence, source, version, area reference, segment, warehouse, pricing, hash, fingerprint, review, and timestamp fields.
- [ ] Persist `clientDifficultyHint`, `derivedAreaDifficulty`, `areaDifficultyFactor`, and `derivationReasons`; use the derived value for the order and pricing.
- [ ] Preserve compatibility with existing order and price snapshots and keep old orders readable.
- [ ] Run focused area, checkout, pricing, and integrity tests.

## Task 3: Fix customer-facing aggregates and notification visibility

- [ ] Add a regression test proving dashboard distributed flyers sums real completed order/report quantities instead of multiplying one order by count.
- [ ] Add a central customer notification visibility predicate and tests for list, unread count, latest message, and preferences.
- [ ] Keep internal/admin/distributor/module/seed/fixture/smoke/debug notifications out of customer responses without changing admin visibility.
- [ ] Verify customer language remains non-technical and no forbidden internal markers leak.

## Task 4: Health/readiness and payment-mode safety

- [ ] Add `/api/ready` with 200 for ready and 503 for degraded/down; keep `/api/health` fail-safe with 503 only for down.
- [ ] Update Docker healthchecks and add schema/status regression tests.
- [ ] Make `PAYMENT_MODE=test|live` explicit in production preflight; enforce live keys/webhook for live and explicit opt-in for test payments.
- [ ] Add regression coverage for mock, test, and live payment configuration combinations.

## Task 5: Production parity and service-pricing CI

- [ ] Add a production-runtime CI job that installs dependencies, generates Prisma, deploys migrations, seeds the test database, builds, starts the production server, and runs runtime checks.
- [ ] Keep dev-server checks as supplementary only; production tests must not be replaced by them.
- [ ] Add the required service-pricing and no-fallback scripts to push/PR CI.
- [ ] Ensure existing uncommitted role portal/mobile work remains covered and production-role checks do not hide real HTTP or hydration failures.

## Task 6: Operational runbook and external integration checks

- [ ] Add `docs/PRODUCTION_PILOT_RUNBOOK.md` covering registration, area selection, quote, checkout, Stripe webhook, confirmation, warehouse, evidence, report publication, email, refund, expected DB/status/customer views, rollback, and failure handling.
- [ ] Add a safe documented preflight/check script for Maps browser/server, Stripe, Resend/SMTP, S3, malware scan, notification worker, Restic backup/restore, and secret hygiene.
- [ ] Do not claim external provider verification unless the check actually ran with production credentials.

## Task 7: Full verification and delivery

- [ ] Run Prisma validate/generate, lint, build, all required focused/regression tests, and production runtime tests.
- [ ] Capture and inspect 1440px and 390px screenshots for affected customer/admin surfaces; report any failed screenshot honestly.
- [ ] Review `git diff`, commit logically related changes, push the working branch, and record commit/branch and remaining risks.
